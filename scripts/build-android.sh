#!/usr/bin/env bash
# Build Workbench mobile for Android, in Docker only: no Android Studio, no
# emulator, nothing installed on the host. Runs as your own uid.
#
#   scripts/build-android.sh                  # release APK + AAB, arm64-v8a (phones of the last ~8 years)
#   ARCHS=arm64-v8a,x86_64 scripts/build-android.sh   # also runs on an x86_64 emulator
#   AAB=0 scripts/build-android.sh            # the APK only
#   VARIANT=debug scripts/build-android.sh    # debug APK: loads the JS from Metro, not for handing out
#
# A release APK carries the JS bundle inside it, so it runs on its own. The
# release APK and the AAB (the Play Store's upload) are signed with the
# upload key in $SIGNING_DIR (default ~/.secrets/workbench-mobile:
# upload.keystore and keystore.properties - see README, "Signing"), outside
# the repository and read-only in the container, through
# scripts/android-signing.gradle. Without it they are signed with the debug
# key, with a warning: fine to install by hand, not for a store, and not
# installable over a build signed with the upload key (nor the other way).
#
# Caches (SDK pieces, Gradle, npm) live in $CACHE, not in the repository.
# The results are copied to build-out/workbench-$VARIANT.apk (and .aab).
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="${CACHE:-$HOME/.cache/workbench-android}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm}"
ANDROID_IMAGE="${ANDROID_IMAGE:-reactnativecommunity/react-native-android:v22.0}"
ARCHS="${ARCHS:-arm64-v8a}"
VARIANT="${VARIANT:-release}"
AAB="${AAB:-1}"
case "$VARIANT" in
  release) TASKS=(assembleRelease); [ "$AAB" = 1 ] && TASKS+=(bundleRelease) ;;
  debug) TASKS=(assembleDebug); AAB=0 ;;
  *) echo "VARIANT is release or debug"; exit 1 ;;
esac
SIGNING_DIR="${SIGNING_DIR:-$HOME/.secrets/workbench-mobile}"
SIGN=()
if [ "$VARIANT" = release ]; then
  if [ -f "$SIGNING_DIR/keystore.properties" ] && [ -f "$SIGNING_DIR/upload.keystore" ]; then
    SIGN=(-v "$SIGNING_DIR:/signing:ro" -e WB_SIGNING_PROPS=/signing/keystore.properties)
    echo "signing with the upload key in $SIGNING_DIR"
  else
    echo "WARNING: no upload key in $SIGNING_DIR (keystore.properties + upload.keystore):" >&2
    echo "WARNING: the release is signed with the DEBUG key - not for the Play Store, and it" >&2
    echo "WARNING: cannot be installed over a build signed with the upload key." >&2
  fi
fi
WORKERS="${WORKERS:-4}"
HEAP="${HEAP:-3g}"
USER_ID="$(id -u):$(id -g)"

mkdir -p "$CACHE/sdk" "$CACHE/gradle" "$CACHE/npm" "$REPO/build-out"

# 1. Dependencies, and the native project generated from app.json (android/
#    is generated, git-ignored, never edited by hand). Prebuild rewrites the
#    "android"/"ios" scripts in package.json; that change is put back.
cp "$REPO/package.json" "$CACHE/package.json.keep"
docker run --rm -u "$USER_ID" -e CI=1 \
  -v "$REPO:/app" -v "$CACHE/npm:/home/node/.npm" -w /app "$NODE_IMAGE" \
  bash -c '[ -d node_modules ] || npm ci; npx expo prebuild --platform android --no-install --clean'
cp "$CACHE/package.json.keep" "$REPO/package.json"

# 2. The SDK pieces this React Native wants, in a writable SDK in the cache
#    (the image's own SDK belongs to root and holds other versions).
read -r COMPILE_SDK BUILD_TOOLS NDK < <(awk -F'"' '
  /^compileSdk *=/ {c=$2} /^buildTools *=/ {b=$2} /^ndkVersion *=/ {n=$2}
  END {print c, b, n}' "$REPO/node_modules/react-native/gradle/libs.versions.toml")
docker run --rm -u "$USER_ID" -e HOME=/tmp -v "$CACHE/sdk:/sdk" "$ANDROID_IMAGE" bash -c "
  set -e
  if [ ! -d /sdk/cmdline-tools/latest ]; then
    mkdir -p /sdk/cmdline-tools
    cp -r /opt/android/cmdline-tools/latest /sdk/cmdline-tools/
    cp -r /opt/android/licenses /opt/android/platform-tools /opt/android/cmake /sdk/
  fi
  need=()
  [ -d /sdk/platforms/android-$COMPILE_SDK ] || need+=('platforms;android-$COMPILE_SDK')
  [ -d /sdk/build-tools/$BUILD_TOOLS ] || need+=('build-tools;$BUILD_TOOLS')
  [ -d /sdk/ndk/$NDK ] || need+=('ndk;$NDK')
  if [ \${#need[@]} -gt 0 ]; then
    echo \"installing \${need[*]}\"
    yes | /sdk/cmdline-tools/latest/bin/sdkmanager --sdk_root=/sdk \"\${need[@]}\" > /tmp/sdk.log 2>&1 \
      || { tr '\r' '\n' < /tmp/sdk.log | tail -20; exit 1; }
  fi"

# 3. The APK.
start=$(date +%s)
docker run --rm -u "$USER_ID" -e HOME=/tmp \
  -e ANDROID_HOME=/sdk -e ANDROID_SDK_ROOT=/sdk -e GRADLE_USER_HOME=/gradle "${SIGN[@]}" \
  -v "$REPO:/app" -v "$CACHE/sdk:/sdk" -v "$CACHE/gradle:/gradle" -w /app/android "$ANDROID_IMAGE" \
  ./gradlew "${TASKS[@]}" --no-daemon --max-workers="$WORKERS" --init-script /app/scripts/android-signing.gradle \
    -Dorg.gradle.jvmargs="-Xmx$HEAP -XX:MaxMetaspaceSize=1g" \
    -PreactNativeArchitectures="$ARCHS"
echo "gradle took $(( $(date +%s) - start )) s"

APK="$REPO/android/app/build/outputs/apk/$VARIANT/app-$VARIANT.apk"
OUT="$REPO/build-out/workbench-$VARIANT.apk"
cp "$APK" "$OUT"
# A release APK that does not carry its JS bundle opens on "Unable to load script".
if [ "$VARIANT" = release ] && ! python3 -c 'import sys,zipfile; sys.exit(0 if "assets/index.android.bundle" in zipfile.ZipFile(sys.argv[1]).namelist() else 1)' "$OUT"; then
  echo "the release APK has no assets/index.android.bundle"; exit 1
fi
if [ "$AAB" = 1 ]; then
  cp "$REPO/android/app/build/outputs/bundle/release/app-release.aab" "$REPO/build-out/workbench-release.aab"
fi

# Who signed it: the certificate's name and SHA-256 digest (public; nothing secret).
docker run --rm -u "$USER_ID" -e HOME=/tmp -v "$CACHE/sdk:/sdk" -v "$REPO/build-out:/out:ro" "$ANDROID_IMAGE" \
  bash -c "/sdk/build-tools/$BUILD_TOOLS/apksigner verify --print-certs /out/workbench-$VARIANT.apk" \
  | grep -E 'certificate DN|certificate SHA-256 digest'
if [ "$VARIANT" = release ] && [ ${#SIGN[@]} -eq 0 ]; then
  echo "WARNING: signed with the DEBUG key (no upload key found)" >&2
fi
ls -lh "$OUT" "$REPO/build-out/workbench-release.aab" 2>/dev/null || ls -lh "$OUT"
echo "APK: $OUT"
[ "$AAB" = 1 ] && echo "AAB: $REPO/build-out/workbench-release.aab"
true

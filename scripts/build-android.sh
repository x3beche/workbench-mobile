#!/usr/bin/env bash
# Build a debug APK of Workbench mobile, in Docker only: no Android Studio, no
# emulator, nothing installed on the host. Runs as your own uid.
#
#   scripts/build-android.sh            # arm64-v8a only (phones of the last ~8 years)
#   ARCHS=arm64-v8a,armeabi-v7a,x86_64 scripts/build-android.sh
#
# Caches (SDK pieces, Gradle, npm) live in $CACHE, not in the repository.
# The APK is copied to build-out/workbench-debug.apk.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="${CACHE:-$HOME/.cache/workbench-android}"
NODE_IMAGE="${NODE_IMAGE:-node:22-bookworm}"
ANDROID_IMAGE="${ANDROID_IMAGE:-reactnativecommunity/react-native-android:v22.0}"
ARCHS="${ARCHS:-arm64-v8a}"
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
  -e ANDROID_HOME=/sdk -e ANDROID_SDK_ROOT=/sdk -e GRADLE_USER_HOME=/gradle \
  -v "$REPO:/app" -v "$CACHE/sdk:/sdk" -v "$CACHE/gradle:/gradle" -w /app/android "$ANDROID_IMAGE" \
  ./gradlew assembleDebug --no-daemon --max-workers="$WORKERS" \
    -Dorg.gradle.jvmargs="-Xmx$HEAP -XX:MaxMetaspaceSize=1g" \
    -PreactNativeArchitectures="$ARCHS"
echo "gradle took $(( $(date +%s) - start )) s"

APK="$REPO/android/app/build/outputs/apk/debug/app-debug.apk"
cp "$APK" "$REPO/build-out/workbench-debug.apk"
ls -lh "$REPO/build-out/workbench-debug.apk"
echo "APK: $REPO/build-out/workbench-debug.apk"

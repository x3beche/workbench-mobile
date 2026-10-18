# Server changes for the mobile app

The app talks to an unchanged Workbench server (redline-studio). Everything it
needs on Android and iOS works today; this file lists what would make it work
in more places, or more robustly, and the exact change proposed for each.
None of these are made by this repository - they belong in redline-studio.
Sections 5 and 6 are made there now; the app uses them and falls back for
an older server.

Status at the time of writing (October 2026), checked against
`backend/main.py`, `backend/auth.py`, `backend/cc_chat.py` and
`backend/voice.py`:

| Need | Native app (Android/iOS) | Web build on another origin |
|---|---|---|
| Sign in (`POST /api/auth/login`, cookie `redline_session`) | works: the platform cookie store keeps the HttpOnly cookie | blocked: CORS and `SameSite=Lax` (change 1) |
| CSRF header `x-redline-csrf: 1` | sent on every mutating request | same |
| Chat list, read, create, model, stop | works | blocked by CORS (change 1) |
| Answer streaming (`POST /messages` and `GET /live`, SSE) | works: read through XMLHttpRequest progress | blocked by CORS (change 1) |
| Voice (`POST /api/voice/transcribe`) | works once `backend/voice.py` is deployed | blocked by CORS (change 1) |
| Archive, pin, trash, restore, delete forever (`PATCH`/`DELETE /api/cc/chats/{id}`, `/restore`, `/empty-trash`) | works | blocked by CORS (change 1) |
| Files (`/api/files*`: list, folders, virtual tree, mini, PDF pages, upload, move, copy, trash) | works | blocked by CORS (change 1) |
| Export a conversation (`POST /api/cc/chats/{id}/export`, backend/chat_export.py; kept in Files > In the app > Chat/Exports, then downloaded) | works; an older server without it gets the app's own Markdown or a PDF printed on the phone | blocked by CORS (change 1) |
| The workspace's rooms (3D Drawing, PCB Design, Firmware): `GET /api/chat/rooms`, `GET /api/chat?room=`, `POST /api/chat` with `room` | works since 1.3.0; an older server without `/api/chat/rooms` simply gives the drawer no rooms - the conversations are all it shows | blocked by CORS (change 1) |

## 1. CORS and the cookie for a web build served from another origin (optional)

**Why.** The Expo web build is useful for debugging and for people who want
the phone layout in a browser. Served from any origin other than the
server's own, the browser refuses it twice:

- `backend/main.py` allows only `http://localhost:4200` and
  `http://127.0.0.1:4200` (the Angular dev server), without credentials. The
  live site answered a preflight from `http://localhost:8081` with
  `400 Disallowed CORS origin`.
- `_set_cookie` sets `SameSite=Lax`, so even with CORS allowed the session
  cookie is not sent on a cross-site XHR.

Native apps are not affected (no CORS, and the native cookie stores ignore
SameSite). Until this is changed, the repository's `scripts/dev-proxy.mjs`
serves the web build and the API from one origin, which needs no server
change - so this is only for people who want to host the web build
elsewhere.

**Change** (`backend/main.py`), opt-in, off by default:

```diff
-app.add_middleware(
-    CORSMiddleware,
-    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200"],
-    allow_methods=["*"], allow_headers=["*"],
-)
+# Pages served from elsewhere that may use this server with a session
+# (the mobile app's web build, say): REDLINE_CORS_ORIGINS, comma-separated
+# exact origins. Never "*": the session cookie goes with these requests.
+_EXTRA_ORIGINS = [o.strip().rstrip("/") for o in os.getenv("REDLINE_CORS_ORIGINS", "").split(",") if o.strip()]
+app.add_middleware(
+    CORSMiddleware,
+    allow_origins=["http://localhost:4200", "http://127.0.0.1:4200", *_EXTRA_ORIGINS],
+    allow_credentials=bool(_EXTRA_ORIGINS),
+    allow_methods=["*"], allow_headers=["*"],
+)
```

```diff
 def _set_cookie(response: Response, request: Request, token: str) -> None:
+    # Cross-site pages (REDLINE_CORS_ORIGINS) only get the cookie back with
+    # SameSite=None, which browsers accept only with Secure.
+    cross = bool(_EXTRA_ORIGINS) and request.url.scheme == "https"
     response.set_cookie(auth.COOKIE, token, max_age=auth.SESSION_DAYS * 86400, httponly=True,
-                        samesite="lax", secure=request.url.scheme == "https", path="/")
+                        samesite="none" if cross else "lax", secure=request.url.scheme == "https", path="/")
```

Also add `REDLINE_CORS_ORIGINS` to `deploy.env.example` and to BACKEND.md's
environment table. CSRF stays as it is: the `x-redline-csrf` header is
still required, and a custom header cannot be sent cross-origin without the
preflight that the allow-list controls.

Note: `secure=request.url.scheme == "https"` is only true behind the proxy
when uvicorn trusts forwarded headers (`--proxy-headers
--forwarded-allow-ips=...`); `start.sh` does not pass them. That is harmless
for the native app, but SameSite=None needs Secure, so check it before
turning change 1 on.

## 2. A session token for apps, instead of a cookie (optional, recommended later)

**Why.** The app relies on the platform cookie store (OkHttp's on Android,
NSHTTPCookieStorage on iOS). That works, and is what React Native's fetch
and XMLHttpRequest use by default, but:

- the session cannot be kept in the device's secure storage (Keychain /
  Keystore) or tied to one server explicitly;
- "Sign out of this server" relies on the server's `delete_cookie`;
- another HTTP client (a background task, a share extension) would not see it.

`Authorization: Bearer` cannot be used for this today: the middleware treats
any bearer value as an agent token and answers 401 when it is not one.

**Change** (`backend/main.py` and `backend/auth.py`):

```diff
 class LoginIn(BaseModel):
     email: str = Field(min_length=1, max_length=200)
     password: str = Field(min_length=1, max_length=200)
     remember: bool = False
+    # An app that keeps the session itself: it comes back in the body, once,
+    # and is sent as `Authorization: Session <value>` (no cookie, no CSRF).
+    token: bool = False
```

```diff
     _set_cookie(response, request, token)
     ...
-    return {"user": {...}, "remembered": remembered}
+    out = {"user": {...}, "remembered": remembered}
+    if body.token:
+        out["session"] = token            # the same session; ends on logout as any other
+    return out
```

In `_who_acts`, before the cookie branch, read `Authorization: Session <v>`
(a scheme the agent-token branch does not claim) and resolve it with the
same `auth.session_user()`; skip the CSRF check for it, as for bearer
tokens, because a header cannot be forged by another site. `auth_logout`
should end the session named by that header too. The app would then store
the value per server in `expo-secure-store` and send the header; the
cookie path stays for the web.

## 3. Sign in with a user name (optional)

The request was "user name and password". The server signs in by e-mail
address only (`auth.check_login` looks up `users.email`), so the app's field
says "Email". If names should work too: in `check_login`, when the value
has no `@`, look the account up by `name` (case-insensitive, only when the
name is unique), keeping the dummy-hash timing equalisation for misses.

## 4. Voice: nothing to change, two things to keep

`backend/voice.py` (being written at the time) already matches what the app
sends. Keep:

- the multipart field names `audio`, `lang` (`auto`/`tr`/`en`), `purpose`
  (`chat`/`note`);
- the accepted containers: the app uploads `voice.m4a` as `audio/mp4`
  (AAC, mono, 64 kbit/s) from Android and iOS, and `voice.webm`
  (`audio/webm`, Opus) from a browser; recordings stop at 4 min 55 s, under
  `MAX_SECONDS = 300`, and five minutes at 64 kbit/s is about 2.4 MB, under
  `MAX_BYTES`;
- the access action `draw` for `POST /api/voice/transcribe`, the same as
  sending a chat line.

The app shows the server's `detail` for 400, 502 and 503, and a plain
"this server cannot transcribe voice yet" for a 404 (an older server).

## 4b. Live voice to text: nothing to change, what the app relies on (new in 1.4.0)

The app streams to `WS /api/voice/live` (`backend/voice_live.py`, commits
f899c68 + 0812ae7) as the web app's composer does: `start` with `lang`,
`purpose` and `format: "pcm16"` (`polish: false`), 16 kHz mono PCM16 frames
of 100 ms, `stop`, and it reads `ready`, `partial`, `final`, `done` and
`error`. Keep:

- **Sign-in by the session cookie.** React Native's WebSocket sends the
  platform's cookies for the address (OkHttp's cookie jar on Android,
  NSHTTPCookieStorage on iOS), so the phone needs no agent token. Its
  `Origin` is the server's own `https://host` (React Native sets it from the
  socket's address), so the "Origin host = Host" check passes. A browser on
  the review site (`workbench-mobil.medipol.dev`) has that site's Origin,
  which its nginx maps (verified 2026-10-18).
- **`error` before `ready`** for down, busy and refused, then a close: the
  app records on and writes the recording out with
  `POST /api/voice/transcribe` - as a WAV (`audio/wav`, 16 kHz mono, about
  1.9 MB a minute; five minutes is 9.6 MB, under `MAX_BYTES`). A server
  without the route (the upgrade refused) is treated the same way.
- `final` text concatenated as sent (Whisper's words carry their leading
  space), `partial` replacing the tail, `done.text` the whole text.

`scripts/dev-proxy.mjs` does not pass WebSocket upgrades, so behind it the
web build falls back to the recording, which is what it is there to test.

## 5. Files: smaller answers for a phone - done

Made in redline-studio (October 2026, `backend/files_api.py`,
`backend/files_virtual.py`, `backend/file_minis.py`, tests in
`tests/test_files_mobile.py`), and used by the app from 1.2.1:

1. `GET /api/files?area=own` answers only one's own uploads (My files). The
   app asks for that; an older server ignores the query and answers every
   upload, and the app keeps only those without `where`, as before.
2. `GET /api/files/virtual?under=<folder>` (`""` the roots) answers one
   read-only folder: `{under, trail, folders, files, links, linked}` - the
   folders directly in it, each with `count: {folders, files}`, its own
   files, its links, the rows of the uploads the links refer to (`linked`,
   as `GET /api/files` lists them) and the way to it from the top
   (`trail`). The app reads In the app a folder at a time, and the whole
   tree and every upload only once, for a search there. An older server
   answers the whole tree (no `under` in the answer): the app then works
   as before.
3. `GET /api/files/{id}/thumb?px=<n>` (16-4096) is a picture at the next
   of 320, 800 or 1600 px (never larger than the picture; turned upright,
   without its metadata), WebP or `fmt=jpeg`, made once and kept by
   content beside the row pictures (`file_minis`), with `ETag` and
   `X-Thumb-Px`; for whoever may read the file, Deleted files too; 404 for
   a file that is not a picture. `GET /api/files` says the sizes in
   `X-Thumb-Sizes`. The app's preview asks for the screen's size for a
   picture of 400 kB or more (not a GIF); without `X-Thumb-Px` in the
   answer (an older server answers its 480 px grid picture), or on an
   error, it shows the original (`?inline=1`).

## 6. The conversation trash's days - done

`GET /api/cc/chats?trash=1` answers `X-Trash-Days: 30`
(`cc_chat.TRASH_DAYS`), and keeps the list's shape. The app's "Kept N
days" lines and the delete question follow it once the trash was listed;
an older server's trash is said to keep them 30 days, as before.

## 7. Settings > Mobile app: the new signing key (text change, needed with 1.2.1)

From 1.2.1 the APK is signed with the app's own upload key (README,
"Signing") instead of the debug key. Android does not install an update
signed with another key, so a phone with 1.0.0-1.2.0 must uninstall the app
once before installing 1.2.1. `frontend/src/app/mobile-settings.ts`, the
Install card, says today that the APK is signed with a debug key and that an
update installs over the old one. Proposed text:

```diff
-      <p><b>{{ 'Updating' | t }}</b> · {{ 'download the new APK the same way and install it over the old one; you stay signed in.' | t }}</p>
-      <p><b>{{ 'Not from the Play Store' | t }}</b> · {{ 'the APK is signed with a debug key, so Android asks once whether to allow installing it. Play Protect may ask to scan it.' | t }}</p>
+      <p><b>{{ 'Updating' | t }}</b> · {{ 'download the new APK the same way and install it over the old one; you stay signed in.' | t }}</p>
+      <p><b>{{ 'From 1.2.0 or older' | t }}</b> · {{ 'uninstall Workbench once, then install this one: versions up to 1.2.0 were signed with a test key, and Android installs an update only from the same key ("App not installed"). Type the server address and sign in again; conversations and files are on the server. Later updates install over it.' | t }}</p>
+      <p><b>{{ 'Not from the Play Store' | t }}</b> · {{ 'Android asks once whether to allow installing apps from the browser or Files. Play Protect may ask to scan it.' | t }}</p>
```

with the Turkish lines for `frontend/src/app/i18n.ts`.

## 8. The rooms on the phone: nothing to change (new in 1.3.0)

The workspace's three rooms - 3D Drawing, PCB Design and Firmware - are on the
phone now, leading the drawer above the conversations. No server change is
needed: the app reads and writes exactly what the web app's Rooms list does.

- The list: `GET /api/chat/rooms` - `room`, `count`, `last` (`role`, `text`,
  `at`, `by`), `waiting`, `urgent` and `agent_at` (`backend/chat.py
  rooms()`). `agent_at` is what lets the drawer say how much of a room the
  agent wrote since it was last read on that phone; the phone remembers the
  last read itself, per server and per room.
- A room's thread: `GET /api/chat?room=<cad|pcb|firmware>`, oldest first.
- Saying something in a room: `POST /api/chat` with `room` (and `urgent`
  where the app marks it), which is what tells the agent working in that room.

An older server without `/api/chat/rooms` gives the drawer no rooms - it
shows the conversations, as it did before - so the app is safe on 1.x
servers back to the rooms' own release.

One thing would make this better, and is not needed: the rooms have no
stream. `RoomThread` on the web re-reads every 2 s and so does the phone, so
a line the agent writes appears within about two seconds. A stream for a
room - `GET /api/chat/live?room=`, the shape of the conversation's own
`/live` (`cc_chat.py:1174`) - would let a phone show the agent's answer as it
is written, and let the two of them stop polling.


## 9. The app's own update: works as it is, release notes would be better (new in 1.5.0)

From 1.5.0 the app updates itself from the server it is signed in to: it
reads `GET /api/public/m/app.json` (`backend/mobile_app.py`, `app_json`) and,
when `versionCode` is higher than its own, offers `GET /api/public/m/app.apk`
in Account, checked against `size` and `sha256` before Android's installer
gets it. No server change is needed for that. What the app relies on, to keep:

- `versionCode` in the answer (an APK whose manifest cannot be read and
  that is published without `--version-code` gets `null`; the app then
  compares `version` by number, which is less safe);
- `size` and `sha256` of exactly the file `app.apk` answers - the app
  deletes a download that does not match, so the two must change together
  (they do: `publish()` writes the APK, then `latest.json`);
- the routes open without a session (`/api/public/`), and the rate limits
  (`apk-json` 120 a minute, `apk-file` 20 in ten minutes) as they are: a
  phone asks for app.json at start, on coming back to the front at most every
  four hours, and when Account is opened at most once a minute;
- `url` a path on the same server (the app does not follow it elsewhere).

**Release notes (proposed).** app.json has no word on what changed, so
Account can only show the two versions and the size. The app already reads
`notes` - one text, or `{"en": ..., "tr": ...}` - and shows it under the new
version as "What's new". Proposed in `backend/mobile_app.py`:

```diff
 def publish(src: Path, *, version: str | None = None, version_code: int | None = None,
-            built_at: str | None = None, move: bool = False) -> dict:
+            built_at: str | None = None, move: bool = False, notes: dict | None = None) -> dict:
 ...
     info = {"version": ver, "versionCode": code, "file": name, "size": size, "sha256": digest,
             "built_at": built_at or now_iso(), "published_at": now_iso(),
             "min_sdk": sdk, "min_android": ANDROID.get(sdk) if sdk else None,
-            "abis": got["abis"], "package": got["package"]}
+            "abis": got["abis"], "package": got["package"],
+            # What changed, per language ({"en": ..., "tr": ...}), at most a few lines.
+            "notes": {k: v.strip()[:2000] for k, v in (notes or {}).items() if k in ("en", "tr") and v.strip()} or None}
```

```diff
 def public_info(info: dict) -> dict:
     return {**{k: info.get(k) for k in ("version", "versionCode", "size", "sha256", "built_at", "published_at",
-                                        "min_sdk", "min_android", "abis", "file")},
+                                        "min_sdk", "min_android", "abis", "file", "notes", "package")},
             "url": "/api/public/m/app.apk"}
```

and `notes_en` / `notes_tr` form fields on `POST /api/mobile/apk` (two text
areas in Settings > Mobile app), and `--notes-en` / `--notes-tr` for
`python -m backend.mobile_app publish`. `package` in the public answer would
let the app also refuse a build of another app before downloading it
(Android refuses to install it over Workbench anyway).

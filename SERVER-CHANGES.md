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

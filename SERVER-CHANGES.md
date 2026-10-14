# Server changes for the mobile app

The app talks to an unchanged Workbench server (redline-studio). Everything it
needs on Android and iOS works today; this file lists what would make it work
in more places, or more robustly, and the exact change proposed for each.
None of these are made by this repository - they belong in redline-studio.

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

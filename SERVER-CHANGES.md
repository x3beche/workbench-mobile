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
| Archive, pin, trash, restore, delete forever (`PATCH`/`DELETE /api/cc/chats/{id}`, `/restore`, `/empty-trash`) | works | blocked by CORS (change 1) |
| Files (`/api/files*`: list, folders, virtual tree, mini, PDF pages, upload, move, copy, trash) | works | blocked by CORS (change 1) |
| Export a conversation | written on the phone (no server route: change 5) | same |

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

## 5. Export a conversation (optional, recommended)

**Why.** The app's "Export as Markdown / PDF" (the "…" in a conversation's
top bar) has no server route to call, so it reads the conversation
(`GET /api/cc/chats/{id}`) and writes the Markdown itself
(`src/lib/exportChat.ts`); the PDF is printed on the phone from an HTML page
(expo-print) and, in a browser, through the print dialog. That works, but
the web app cannot export at all, and two exports of the same conversation
(phone and web, later) would differ. One route would serve both.

**Change** (`backend/cc_chat.py`, beside `get_chat`):

```python
@router.get("/chats/{cid}/export")
async def export_chat(cid: str, format: str = "md"):  # noqa: A002 - the query's name
    """The conversation as a file to keep: Markdown (`md`) or a PDF (`pdf`),
    each line with who wrote it and when, answers as they were written
    (tool steps and the hidden context left out)."""
    doc = await _load(cid)
    lines = [f"# {doc.get('title') or 'Conversation'}", ""]
    for m in doc.get("messages") or []:
        who = (m.get("by") or {}).get("name") if m["role"] == "user" else (m.get("model") or "").split("/")[-1]
        lines += [f"## {who or m['role']} · {str(m.get('at', ''))[:16].replace('T', ' ')}", "", m.get("content") or "", ""]
    text = "\n".join(lines)
    name = re.sub(r"[^\w\s-]", "", doc.get("title") or "Conversation").strip()[:60] or "Conversation"
    if format == "pdf":
        from . import pdfdoc                    # the PDF writer the drawings already use
        data = await asyncio.to_thread(pdfdoc.markdown_pdf, text)   # new helper: Markdown -> PDF bytes
        return Response(data, media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="{name}.pdf"'})
    return Response(text, media_type="text/markdown; charset=utf-8",
                    headers={"Content-Disposition": f'attachment; filename="{name}.md"'})
```

Access action `view` (as reading the conversation). Once it exists, the app
would fetch it with the session and hand the bytes to the share sheet
instead of writing the file itself; the phone-side writer stays for older
servers (a 404 falls back to it).

## 6. Files: smaller answers for a phone (optional)

What the app asks today is what the web app's Files room asks, and it is
all one workspace's: `GET /api/files` (every upload, up to 2000),
`GET /api/files/folders` and `GET /api/files/virtual` (the whole read-only
tree). On a phone with many files that is several hundred kB on every
open. Three small changes would let the app read one folder at a time:

1. `files_api.files_list`: an `area` query - `own` keeps only one's own
   uploads (what `files_virtual.area_of` calls `own`), so the app does not
   download the Chat's and Parts' files to drop them. The `folder` filter
   already exists in `files.listing`.

   ```diff
   -async def files_list(q: str = "", kind: str = "", board: str = "", folder: str | None = None):
   +async def files_list(q: str = "", kind: str = "", board: str = "", folder: str | None = None, area: str = ""):
        tops = await files_virtual.folder_tops(_db())
        out = [{**file_out(d), **_owner_of(d, tops)} for d in await files.listing(_db(), q=q, kind=kind, board=board, folder=folder)]
   +    if area == "own":
   +        out = [f for f in out if not f.get("where")]
   ```

2. `files_api.files_virtual_tree`: an `under` query that answers only the
   folders and files directly under one read-only folder
   (`{folders, files, links}` filtered by `parent`/`folder` == `under`).
3. A size for previews: `GET /api/files/{id}/thumb?px=1600` (today the
   thumb is fixed at 480 px, `files.thumb_of`), so a 12 MB photo is not
   downloaded whole to be shown on a 6-inch screen. The app shows
   `?inline=1` (the original) until then.

## 7. The conversation trash's days (optional)

`GET /api/cc/chats?trash=1` gives each conversation's `days_left`, but not
how long the trash keeps them (`cc_chat.TRASH_DAYS`, 30), so the app says
"Kept 30 days" as a fixed sentence. Files' trash answers
`{days, files}`; the same field on the chat side - a response header
`X-Trash-Days: 30` on that list, which keeps the list's shape - would let
the sentence follow the server.

# Workbench mobile

The chat of a Workbench server on your phone: Android,
iOS and the web, from one React Native (Expo) code base, in the web app's own
Spartan Dark theme.

Nothing is built in. The first screen asks for the address of a Workbench
server - yours, your team's, anyone's - and the app remembers the last few.
Then you sign in with the same e-mail address and password as on the web.

<p>
  <img src="docs/screenshots/04-new-chat.png" width="200" alt="A new conversation: greeting and example questions">
  <img src="docs/screenshots/05-drawer.png" width="200" alt="The drawer: search, New chat, conversations by day, the account">
  <img src="docs/screenshots/06-chat.png" width="200" alt="A conversation with the tools it ran and a code block">
  <img src="docs/screenshots/07c-chat-streaming.png" width="200" alt="An answer being written">
</p>
<p>
  <img src="docs/screenshots/07-chat-waiting.png" width="200" alt="Waiting for the first words">
  <img src="docs/screenshots/08-model-picker.png" width="200" alt="Choosing the model">
  <img src="docs/screenshots/09-account.png" width="200" alt="Account, from the drawer">
  <img src="docs/screenshots/14-chat-actions.png" width="200" alt="Rename, archive or delete a conversation">
</p>
<p>
  <img src="docs/screenshots/12-chat-keyboard.png" width="200" alt="With the keyboard open: the composer and the newest lines stay above it">
  <img src="docs/screenshots/16-voice-review.png" width="200" alt="Reviewing a voice note before sending">
  <img src="docs/screenshots/10-login.png" width="200" alt="Signing in">
  <img src="docs/screenshots/01-server.png" width="200" alt="Choosing a server">
</p>
<p>
  <img src="docs/screenshots/26-files.png" width="200" alt="Files: My files with the server's thumbnails">
  <img src="docs/screenshots/27-files-folder.png" width="200" alt="A folder, with the way back above the list">
  <img src="docs/screenshots/29-preview-pdf.png" width="200" alt="A PDF read as the server draws its pages">
  <img src="docs/screenshots/28-preview-image.png" width="200" alt="A picture opened">
</p>
<p>
  <img src="docs/screenshots/30-upload-sheet.png" width="200" alt="Upload from the phone's files, photos or camera">
  <img src="docs/screenshots/33-file-actions.png" width="200" alt="What can be done with a file">
  <img src="docs/screenshots/32-files-in-the-app.png" width="200" alt="In the app: what Workbench keeps, read-only">
  <img src="docs/screenshots/31-files-deleted.png" width="200" alt="Deleted files, kept 30 days">
</p>
<p>
  <img src="docs/screenshots/22-drawer-swipe.png" width="200" alt="A swipe to the left on a conversation: Archive and Delete">
  <img src="docs/screenshots/23-header-menu.png" width="200" alt="The conversation's menu: rename, pin, archive, export, delete">
  <img src="docs/screenshots/24-archived.png" width="200" alt="Archived conversations">
  <img src="docs/screenshots/25-trash.png" width="200" alt="The trash: restore or delete forever">
</p>
<p>
  <img src="docs/screenshots/21-wide-chat.png" width="520" alt="On a wide screen the drawer is a column that stays open">
  <img src="docs/screenshots/34-wide-scrollbar.png" width="520" alt="The web build's thin scrollbars, as the web app draws them">
</p>

## What it does

- **Any server.** Type an address (`workbench.example.com`, `https://...`,
  or `http://192.168.1.20:8000` on a local network). The app checks that it
  answers as Workbench (`/api/health`, `/api/auth/state`) before going on.
  The last five servers are listed for one-tap switching.
- **Sign in** with e-mail and password. A server running without sign-in
  (local mode) goes straight to the chat.
- **Straight into a conversation.** The app opens on the conversation that
  was open last, or on a new one: the mark, a greeting and four example
  questions - the ones the server writes from your own projects
  (`GET /api/cc/ideas`), or hand-written ones when it has none. A question
  tapped goes into the box to edit or send. A new conversation is made on
  the server with its first line.
- **The drawer** slides in from the left (the button at the top left, or a
  swipe to the right), follows the finger and springs open or shut; the
  conversation dims behind it. A tap on the dimmed side, a swipe to the
  left or Back puts it away. At its top: search (titles at once, what was
  said in them from the server) and New chat; then Chats, Archived and
  Trash as three tabs, and the conversations by Pinned, Today, Yesterday,
  Previous 7 days and Older, one line each, the open one in heavier,
  brighter ink (pull to refresh). A swipe to the left on a row shows
  Archive and Delete (Unarchive in Archived; Restore and Delete forever
  in Trash, with Empty trash above the list); Delete asks first and puts
  the conversation in the server's trash, kept 30 days. A long press, or
  the "…" in a conversation's top bar, offers everything: Rename, Pin or
  Unpin, Archive, Export as Markdown or PDF, Delete. The server writes the
  export (in the document theme, kept in Files > In the app > Chat/Exports)
  and the app hands it to the share sheet (a download on the web); an older
  server without the route gets the app's own Markdown or a PDF printed on
  the phone.
  At the bottom: Files, and the account, which opens Account: the server,
  the voice language, Change server and Sign out. On a screen 860 px or
  wider the drawer is a column that stays open.
- **Files**, as on the web: My files (one's own folders and uploads), In
  the app (what Workbench keeps - projects, the Chat's files, Parts,
  agents - read-only) and Deleted (kept 30 days, with Restore). Folders
  open in place with the way back above the list; each row has the
  server's small picture (a photo, a PDF's first page, a model's view;
  `GET /api/files/{id}/mini`, asked again while the server makes it), its
  size and date. A tap opens a file: pictures, PDFs (the server draws the
  pages), Markdown, text and code, and tables in the app; anything else
  goes to another app through the share sheet. A long press or the row's
  "…": Share, Save to phone (Android), Rename, Move, Delete, or Save to My
  files for what the app made. The "+" uploads from the phone's files,
  photos or camera into the open folder, or makes a folder. What a role
  may not do is not offered (a viewer only looks), and when the server
  refuses, its own words are shown. A newer server answers a phone with
  less: only one's own uploads, In the app a folder at a time, and a large
  photo at the screen's size instead of the original
  (`/api/files?area=own`, `/api/files/virtual?under=`,
  `/api/files/{id}/thumb?px=`); an older server is read as before.
- **A conversation**: the model's name at the top, tapped to choose another;
  New chat at the right. Your lines are bubbles on the right; answers run the
  full width under the model's name, with Markdown (headings, lists, code
  with a Copy button, links) and the tools the answer ran as compact rows
  where they ran, each opening to what it found. A long press on a line
  copies it or opens it to select a part. Your line shows the moment it is
  sent, three dots wait for the first words, and the answer is written in
  place - laid out as it will stay, so nothing jumps when it is done. A
  conversation in which someone else's answer is being written is followed
  live. The list follows the newest line unless you scroll up to read; then
  a round arrow brings you back.
- **Typing**: a rounded box floats right above the keyboard, the conversation
  shrinks above it with the newest lines in view, and the box grows with
  what you write up to six lines (16 px text), then scrolls inside. Its round
  button is Send when there is text, Stop while an answer is written, and
  Voice note otherwise. Sending and New chat give a light haptic tick.
- **Voice**: the microphone in the box records, the server transcribes
  (`POST /api/voice/transcribe`), and the text lands in the box to read and
  correct - nothing is sent by itself. Voice note (the round button, with
  nothing typed) records, shows the transcript for review, then sends it.
  The language is Auto, Türkçe or English (Account).
- **Back** (Android) closes a sheet, then the drawer, then goes back to the
  conversation open before, then leaves the app.

The device keeps only the server list, the last e-mail address and the last
open conversation per server, and the voice language. Never a password. A
file shared or saved is written to the app's cache first, then handed over. The session is the server's own
HttpOnly cookie, kept by the platform's cookie store.

## Run it

You need Node.js 22 or newer.

```sh
npm install
npm start          # Expo dev server: press a for Android, i for iOS, w for web
```

With the [Expo Go](https://expo.dev/go) app you can scan the QR code, but voice
recording needs a development build (`npx expo run:android` /
`npx expo run:ios`) or the APK below.

### Point it at your own server

Start the app and type your server's address on the first screen. That is
all: there is no configuration file and no address in the code. To try it
against a server on your machine, use the address your phone can reach (the
computer's LAN address, not `localhost`); plain `http://` works for local
addresses.

The server needs sign-in turned on (`REDLINE_REQUIRE_SIGNIN=1`) for accounts,
an LLM key for answers, and a "voice" model for voice input - see the
Workbench documentation. Native apps need no server change.
[SERVER-CHANGES.md](SERVER-CHANGES.md) lists what a web build hosted on
another origin would need (CORS), and other optional improvements.

### In a browser

A browser applies CORS, which a Workbench server does not allow for other
origins. The dev proxy serves the web build and forwards `/api` to the
server, so both come from one origin:

```sh
npx expo export --platform web
TARGET=https://workbench.example.com node scripts/dev-proxy.mjs
# open http://localhost:8090 and enter localhost:8090 as the server
```

`MOCK=1 node scripts/dev-proxy.mjs` answers from a made-up server instead
(`scripts/mock-api.mjs`, no account needed, with archived and deleted
conversations, and Files from `scripts/mock-files.mjs`); add `MOCK_HOLD=1` to leave
answers half-written, or `MOCK_SIGNIN=1` to start signed out (the password
`mock` signs in, any other is refused).

### Android APK and AAB (no Android Studio)

```sh
WORKERS=2 scripts/build-android.sh   # Docker: expo prebuild + gradlew assembleRelease bundleRelease (JS bundle inside)
# -> build-out/workbench-release.apk   to install by hand, or to publish on the server
# -> build-out/workbench-release.aab   to upload to the Play Store
adb install build-out/workbench-release.apk
# AAB=0 builds the APK only; VARIANT=debug gives a debug APK, which loads its JS from Metro - not for handing out
```

At the end the script prints who signed the APK: the certificate's name
(DN) and its SHA-256 digest, as `apksigner verify --print-certs` reads them.

### Signing

From 1.2.1 the release APK and the AAB are signed with the app's own
**upload key**, which is kept outside the repositories:

```
~/.secrets/workbench-mobile/          (0700)
  upload.keystore                      (0600)  PKCS12, RSA 4096, alias workbench-upload, valid 30 years
  keystore.properties                  (0600)  storeFile, storePassword, keyAlias, keyPassword
```

`scripts/build-android.sh` mounts that folder read-only into the build
container and signs the release through a Gradle init script
(`scripts/android-signing.gradle`) - the generated `android/` project is not
edited, and the passwords are never on a command line, in the repository
or in the build log. Another folder: `SIGNING_DIR=/path scripts/build-android.sh`.
Without the two files the build still works, signed with the debug key, and
says so with a warning; such a build is for trying out only.

To make a new key on another machine (only if there was never one - see
below):

```sh
mkdir -p ~/.secrets/workbench-mobile && chmod 700 ~/.secrets ~/.secrets/workbench-mobile
# keystore.properties: storeFile=upload.keystore, storePassword=<random>, keyAlias=workbench-upload,
# keyPassword=<the same; PKCS12 has one password>; then:
keytool -genkeypair -storetype PKCS12 -keystore ~/.secrets/workbench-mobile/upload.keystore \
  -alias workbench-upload -keyalg RSA -keysize 4096 -validity 10950 -dname "CN=Workbench Mobile, O=Workbench"
chmod 600 ~/.secrets/workbench-mobile/*
```

**Uninstall the old app once.** Versions 1.0.0 to 1.2.0 were signed with
the debug key. Android installs an update only when it is signed with the
same key as the app on the phone, so 1.2.1 cannot be installed over them
("App not installed" / "package conflicts with an existing package").
Uninstall Workbench once, then install 1.2.1; from then on every build
signed with the upload key installs over the one before, as an update. The
app keeps nothing that cannot be typed again: the server list and the last
e-mail address are gone, the conversations and files are on the server.

**Back up the key - losing it means no more updates.** An installed app,
and an app on the Play Store, takes updates only from the same key (with
Play App Signing, Google can reset a lost upload key after a support
request, but only once the app is enrolled; outside the Play Store there is
no way back - everyone has to uninstall again). So:

- copy both files, `upload.keystore` and `keystore.properties`, somewhere
  safe off this machine - an encrypted backup or a USB stick in a drawer;
- store the password (the `storePassword` line) and the alias in your
  password manager, with a note of where the keystore copy is - and attach
  the keystore file itself to that entry if the password manager takes
  files;
- never commit them: `*.keystore`, `*.jks` and `keystore.properties` belong
  in no repository.

Check a copy with `keytool -list -v -keystore upload.keystore` (it asks for
the password): the SHA-256 fingerprint must match the one the build prints.

## Develop

```sh
npm run typecheck
npm run lint
npm test
npm run check      # all three
```

Screenshots in `docs/screenshots` are made with `scripts/shots.sh` (headless
Chrome in Docker at 390 x 844, and 900 px wide for the side column, against
the made-up server, which also runs tools and writes an answer slowly; with
`TARGET=https://your.server` the server and sign-in screens are taken against
that server, whose own wrong-password error is shown). The keyboard shot
makes the window 336 px shorter, as a phone keyboard does, and checks the
composer is still on screen. `SHOTS_DIR=/some/dir` writes them elsewhere. App icons are
drawn by `scripts/make-icons.js` from the web app's section mark.

### How it talks to the server

| What | Request |
|---|---|
| Is it Workbench? | `GET /api/health`, `GET /api/auth/state` |
| Sign in / out | `POST /api/auth/login` `{email, password}` (sets `redline_session`), `POST /api/auth/logout` |
| Conversations | `GET /api/cc/chats` (`q=` searches what was said), `POST /api/cc/chats`, `GET /api/cc/chats/{id}`, `PATCH .../{id}` (model, `title`, `archived`), `DELETE .../{id}` (into the trash) |
| Example questions | `GET /api/cc/ideas?lang=en\|tr` (`items`, `source`, `start`: the model a new conversation begins with) |
| Send and stream | `POST /api/cc/chats/{id}/messages` answers with `text/event-stream`: `user`, `thinking`, `text` (with `at`), `steps` (the tools run so far), `error`, `done`, `title`; `202` JSON when the line was queued |
| Follow someone's answer | `GET /api/cc/chats/{id}/live` (`hello`, `start`, `text`, ..., `end`, `bye`) |
| Stop | `POST /api/cc/chats/{id}/stop` |
| Models | `GET /api/llm/settings` (providers with a key), `GET /api/llm/models?provider=` |
| Voice | `POST /api/voice/transcribe` multipart `audio`, `lang`, `purpose` |
| Export | `POST /api/cc/chats/{id}/export` `{format: md\|pdf, lang}` (the file kept in Files), then `GET /api/files/{fileId}` |
| Archive, pin, trash | `GET /api/cc/chats?archived=1` / `?trash=1`, `PATCH .../{id}` (`archived`, `pinned`), `POST .../{id}/restore`, `DELETE .../{id}?forever=1`, `POST /api/cc/chats/empty-trash` |
| What the account may do | `GET /api/auth/state` (`can`: `draw` to change files, `delete` for anyone's) |
| Files | `GET /api/files`, `/api/files/folders`, `/api/files/virtual` (In the app), `/api/files/trash`; `GET /api/files/{id}?inline=1` (Range for text), `/mini` (202 while it is made), `/pdf?pages=1` (the page count), `/pdf/page/{n}.png`, `/table`; `POST /api/files` (multipart `upload`, `folder`), `PATCH /api/files/{id}` (name), `DELETE /api/files/{id}` (to Deleted), `POST /api/files/move`, `POST /api/files/{id}/copy` (Save to My files), `POST /api/files/trash/restore` and `/purge`, `POST`/`PATCH`/`DELETE /api/files/folders` |

Every request that changes something carries `x-redline-csrf: 1`. React
Native has no `EventSource` and no streaming `fetch` body, so the event
streams are read through `XMLHttpRequest` progress events, which work the
same in a browser (`src/api/sse.ts`).

### Layout

```
src/
  App.tsx               fonts, session, which screen shows
  api/                  server address, HTTP client, SSE reader, types
  state/session.tsx     server -> sign-in -> app
  storage/prefs.ts      recent servers, last e-mail, voice language
  screens/              Server, Login, Workspace (drawer + conversation or Files), Chat,
                        Files, FilePreview
  components/           Drawer, DrawerPanel, SwipeRow, Tabs, FileThumb, Markdown, MessageItem,
                        Composer, RecordingBar, sheets and dialogs, icons (Lucide), controls
  lib/                  Markdown parser, answer-stream reducer, day groups, tool steps, times,
                        Files (what each side shows, rights), chat export, share (native / web)
  voice/                recorder hook and its pure helpers
  theme/tokens.ts       Spartan Dark, copied from the web app's styles.css
  theme/scrollbars*     the web build's scrollbars, as the web app's (thin, faint thumb, no track)
scripts/                dev proxy, screenshots, Android build
```

### Design rules

The theme is the web app's Spartan Dark token for token
(`src/theme/tokens.ts`, from redline-studio's `frontend/src/styles.css`), set
in IBM Plex Sans and Plex Mono like the web app. Type: titles 17-20, body 16,
meta 12-13. Flat surfaces with 1 px hairlines; a chosen option or the open
conversation is shown by weight and ink, not a fill; no coloured stripes, no
emoji; recording is a small red dot and a timer. Scrollbars on the web
build are the web app's (thin, a faint rounded thumb on no track, brighter
under the pointer); phones keep their own overlay indicator, white on iOS. Icons are Lucide line icons
(`components/icons.ts`), the same family of plain line drawings as the web
app, drawn as vectors. The wordmark is the web app's section mark (a vector,
`components/Mark.tsx`) beside the name.

Every screen keeps a 16 px side gutter and the safe-area insets (status bar,
cutout, gesture bar); controls are at least 44 px tall. Motion is short and
moves only opacity and transform: the native splash (the mark on the theme's
ground) fades into the first screen, the drawer follows the finger and
settles in a spring without overshoot (240 ms when opened by its button), its
rows come in a little behind its edge, a conversation fades in, lines and
the answer fade in in 160 ms, sheets rise in 180 ms - and with the system's
reduced-motion setting on, none of it moves (`components/Appear.tsx`,
`components/Drawer.tsx`, `components/motion.ts`).

### Keyboard

The app draws edge to edge (Android 15 requires it), and then Android's
`adjustResize` no longer shrinks the window for the keyboard.
[react-native-keyboard-controller](https://github.com/kirillzyusko/react-native-keyboard-controller)
reports the keyboard frame by frame, and `components/KeyboardSpacer.tsx`
takes that room at the bottom of the chat and of the sheets, so the list
shrinks and the composer sits on the keyboard. The server and sign-in screens
scroll the focused field clear of it (`KeyboardAwareScrollView`). The
manifest keeps `windowSoftInputMode="adjustResize"`
(`android.softwareKeyboardLayoutMode: "resize"` in app.json), which the
library expects.

## Licence

MIT - see [LICENSE](LICENSE). The main Workbench repository had no licence
file when this was written, so MIT was chosen here. IBM Plex is under the SIL
Open Font License. The web app's wordmark face (Switzer) is not
redistributable and is not included; the wordmark uses Plex Sans SemiBold.

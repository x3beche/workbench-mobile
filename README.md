# Workbench mobile

The chat of a Workbench server on your phone: Android,
iOS and the web, from one React Native (Expo) code base, in the web app's own
Spartan Dark theme.

Nothing is built in. The first screen asks for the address of a Workbench
server - yours, your team's, anyone's - and the app remembers the last few.
Then you sign in with the same e-mail address and password as on the web.

<p>
  <img src="docs/screenshots/01-server.png" width="200" alt="Choosing a server">
  <img src="docs/screenshots/03-login-error.png" width="200" alt="Signing in, with the server's error">
  <img src="docs/screenshots/04-chats.png" width="200" alt="Conversation list">
  <img src="docs/screenshots/05-chat.png" width="200" alt="A conversation with an answer being written">
</p>
<p>
  <img src="docs/screenshots/06-voice-recording.png" width="200" alt="Recording a voice message">
  <img src="docs/screenshots/07-voice-review.png" width="200" alt="Reviewing a voice note before sending">
  <img src="docs/screenshots/08-model-picker.png" width="200" alt="Choosing the model">
  <img src="docs/screenshots/09-account.png" width="200" alt="Account, voice language, sign out">
</p>

## What it does

- **Any server.** Type an address (`workbench.example.com`, `https://...`,
  or `http://192.168.1.20:8000` on a local network). The app checks that it
  answers as Workbench (`/api/health`, `/api/auth/state`) before going on.
  The last five servers are listed for one-tap switching.
- **Sign in** with e-mail and password. A server running without sign-in
  (local mode) goes straight to the chat.
- **Chat**: the workspace's conversations (pull to refresh), open one, read
  it with Markdown (headings, lists, code, links), send a line and watch the
  answer being written, stop it, start a new conversation, choose the model.
  A conversation in which someone else's answer is being written is followed
  live.
- **Voice**: the composer's Voice button records, the server transcribes
  (`POST /api/voice/transcribe`), and the text lands in the box to read and
  correct - nothing is sent by itself. Voice note (in a conversation's top
  bar) records, shows the transcript for review, then sends it. The language
  is Auto, Türkçe or English (Account).
- **Sign out**, or change server, from Account.

The device keeps only the server list, the last e-mail address per server and
the voice language. Never a password. The session is the server's own
HttpOnly cookie, kept by the platform's cookie store.

## Run it

You need Node.js 22 or newer.

```sh
npm install
npm start          # Expo dev server: press a for Android, i for iOS, w for web
```

With the [Expo Go](https://expo.dev/go) app you can scan the QR code, but voice
recording needs a development build (`npx expo run:android` /
`npx expo run:ios`) or the debug APK below.

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
(`scripts/mock-api.mjs`, no account needed); add `MOCK_HOLD=1` to leave
answers half-written.

### Android debug APK (no Android Studio)

```sh
scripts/build-android.sh      # Docker: expo prebuild + gradlew assembleDebug
# -> build-out/workbench-debug.apk
adb install build-out/workbench-debug.apk
```

## Develop

```sh
npm run typecheck
npm run lint
npm test
npm run check      # all three
```

Screenshots in `docs/screenshots` are made with `scripts/shots.sh` (headless
Chrome in Docker at 390 x 844, against the made-up server; with
`TARGET=https://your.server` it also takes the server and sign-in screens
against that server, whose own wrong-password error is shown). App icons are
drawn by `scripts/make-icons.js` from the web app's section mark.

### How it talks to the server

| What | Request |
|---|---|
| Is it Workbench? | `GET /api/health`, `GET /api/auth/state` |
| Sign in / out | `POST /api/auth/login` `{email, password}` (sets `redline_session`), `POST /api/auth/logout` |
| Conversations | `GET /api/cc/chats`, `POST /api/cc/chats`, `GET /api/cc/chats/{id}`, `PATCH .../{id}` (model) |
| Send and stream | `POST /api/cc/chats/{id}/messages` answers with `text/event-stream`: `user`, `thinking`, `text` (with `at`), `error`, `done`, `title`; `202` JSON when the line was queued |
| Follow someone's answer | `GET /api/cc/chats/{id}/live` (`hello`, `start`, `text`, ..., `end`, `bye`) |
| Stop | `POST /api/cc/chats/{id}/stop` |
| Models | `GET /api/llm/settings` (providers with a key), `GET /api/llm/models?provider=` |
| Voice | `POST /api/voice/transcribe` multipart `audio`, `lang`, `purpose` |

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
  screens/              Server, Login, ChatList, Chat
  components/           Markdown, MessageItem, Composer, RecordingBar, sheets, controls
  lib/                  Markdown parser, answer-stream reducer, times
  voice/                recorder hook and its pure helpers
  theme/tokens.ts       Spartan Dark, copied from the web app's styles.css
scripts/                dev proxy, screenshots, Android build
```

### Design rules

The theme is the web app's Spartan Dark token for token
(`src/theme/tokens.ts`, from redline-studio's `frontend/src/styles.css`), set
in IBM Plex Sans and Plex Mono like the web app. Flat surfaces with 1 px
hairlines; a chosen option is shown by weight and ink, not a fill; no coloured
stripes, no emoji; recording is a small red dot and a timer. Screens and
sheets appear without animation, so nothing moves for longer than 200 ms and
a reduced-motion setting has nothing to turn off.

## Licence

MIT - see [LICENSE](LICENSE). The main Workbench repository had no licence
file when this was written, so MIT was chosen here. IBM Plex is under the SIL
Open Font License. The web app's wordmark face (Switzer) is not
redistributable and is not included; the wordmark uses Plex Sans SemiBold.

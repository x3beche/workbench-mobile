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
  <img src="docs/screenshots/21-wide-chat.png" width="520" alt="On a wide screen the drawer is a column that stays open">
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
  said in them from the server) and New chat; then the conversations by
  Pinned, Today, Yesterday, Previous 7 days and Older, one line each, the
  open one in heavier, brighter ink (pull to refresh). A long press on one
  offers Rename, Archive and Delete (into the server's trash). At the
  bottom, the account opens Account: the server, the voice language,
  Change server and Sign out. On a screen 860 px or wider the drawer is a
  column that stays open.
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
open conversation per server, and the voice language. Never a password. The session is the server's own
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
(`scripts/mock-api.mjs`, no account needed); add `MOCK_HOLD=1` to leave
answers half-written, or `MOCK_SIGNIN=1` to start signed out (the password
`mock` signs in, any other is refused).

### Android APK (no Android Studio)

```sh
scripts/build-android.sh      # Docker: expo prebuild + gradlew assembleRelease (JS bundle inside)
# -> build-out/workbench-release.apk
adb install build-out/workbench-release.apk
# VARIANT=debug gives a debug APK, which loads its JS from Metro - not for handing out
```

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
  screens/              Server, Login, Workspace (drawer + conversation), Chat
  components/           Drawer, DrawerPanel, Markdown, MessageItem, Composer, RecordingBar,
                        sheets and dialogs, icons (Lucide), controls
  lib/                  Markdown parser, answer-stream reducer, day groups, tool steps, times
  voice/                recorder hook and its pure helpers
  theme/tokens.ts       Spartan Dark, copied from the web app's styles.css
scripts/                dev proxy, screenshots, Android build
```

### Design rules

The theme is the web app's Spartan Dark token for token
(`src/theme/tokens.ts`, from redline-studio's `frontend/src/styles.css`), set
in IBM Plex Sans and Plex Mono like the web app. Type: titles 17-20, body 16,
meta 12-13. Flat surfaces with 1 px hairlines; a chosen option or the open
conversation is shown by weight and ink, not a fill; no coloured stripes, no
emoji; recording is a small red dot and a timer. Icons are Lucide line icons
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

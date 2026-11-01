# The Office on the phone: the web's page in a WebView

The picture of the Office is the **web's own**, and the phone shows it rather than drawing it. `/office/embed`
(#a02107) is the page; the phone hosts it in a WebView, hands it the theme, the language and the safe-area insets,
and hears back what a tap on a character means. `src/lib/officeEmbed.ts` is the protocol, `src/components/
OfficeEmbed.tsx` the host (and `.web.tsx` the iframe the screenshots are taken from), `src/screens/OfficeScreen.tsx`
the screen around it.

The requirement behind it: *the mobile must look the same as the web; the web should be so good that mobile takes it
one-to-one.* Two drawings drift apart the moment one of them is touched - the phone's old `src/lib/office` engine
(an isometric-free, top-down approximation of the web's canvas, 2 449 lines with its tests) was retired for that
reason, and the page is the only drawing there is.

## The trade-off

**What it costs.** `react-native-webview` (13.16.1, the version Expo SDK 57 picks) is the one new native dependency:
992 KB on disk unpacked, 252 KB of it Android sources and its bridge. No browser engine is bundled - Android's
WebView and iOS's WKWebView are the system components, already on the phone and updated by the platform - so the
APK grows by the library's own bytecode, not by a Chromium. (An exact APK delta needs `scripts/build-android.sh`,
minutes of Gradle, and is worth taking when the release is cut; the library is the only addition.)

**What it gives back.** 2 449 lines of drawing code and eight test files left the app, so the JS bundle is smaller
than it was, and every later change to the office - the isometric engine, the art, the director's faces, the day's
light - lands once, on the web, and the phone shows it with no release. The WebView is only warm while the Office
screen is in front; the page is told `pause` the moment the app goes behind another one.

**The alternative we did not take.** Keeping the phone's own engine and porting each web change: it is what the
last three tasks did (the director's fields, the hour, the cars, the art), and each port was a place the two
pictures could disagree. Drawing in Skia/Canvas natively would have been a third engine - more native code than the
WebView, and the isometric engine is the web's.

## The protocol

Page → app (`postMessage`, JSON):

| message | what the app does |
| --- | --- |
| `{"type":"ready"}` | the picture is drawn: the bar says "Read only" until the state arrives |
| `{"type":"state","floor":…,"agents":…}` | the bar's second line: `Ground floor · 4 agents` |
| `{"type":"open","agent":"wbo:ses_…"}` | opens that session, the same as the drawer does |
| `{"type":"error","message":…}` | a calm line over the space, with Try again (a new ticket) |

App → page (the page's `window.__workbenchOffice(json)`):

| message | when |
| --- | --- |
| `{"type":"hello","theme":"dark\|light","themeId":…,"lang":"en\|tr","insets":{…},"server":…}` | on load, and whenever any of it changes |
| `{"type":"pause"}` / `{"type":"resume"}` | the app went behind another one, and came back |

Anything else a page sends is ignored: a newer page may say more than this build knows.

## The ticket, never the session

The page speaks for the person's account. The account's session never leaves the app: a WebView keeps what it
loaded in its history, and a URL ends up in logs and crash reports. So the app asks for a one-off ticket
(`POST /api/office/embed-token`, `backend/office_embed.py` in `redline-studio`), opens the page with it in the
`x-office-embed` **header**, and the page's own route spends it at once for that account - single use, sixty
seconds, only its digest kept. The app's ticket read happens once per screen, never in the background, and a retry
reads a new one.

`ready: false` in that answer is the server saying it has **no page yet** (`OFFICE_EMBED` off, #a02107 in
progress): the app then draws its stand-in page (`MOCK_EMBED_HTML` in `src/lib/officeEmbed.ts`), which speaks the
same protocol - so switching to the real page is the server's answer, not an app release, and the bridge, the
lifecycle and the bar are exercised now.

## Until the page lands

`scripts/mock-office.mjs` answers the ticket with `ready: false`; `MOCK_OFFICE_EMBED=/office/embed` on the mock
server takes the "real page" branch instead. `scripts/shots-office.js` takes the 390 pt picture of the screen with
the stand-in (`docs/screenshots/151-office-embed.png`).

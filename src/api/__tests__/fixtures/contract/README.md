# The server's answers, as the app's types expect them

Each file here is a real answer from the live server (**https://redline.medipol.dev**), taken on the test
account `6e576197edeb4673` (its ids stand in as `0aa1b2c3d4e5f607` here) on 2026-10-31, and kept so the app's
types can be checked against it on every `npm test` (`src/api/__tests__/contract.test.ts`, whose report is
`scripts/contract-check.ts`).

| file | from | checked as |
| --- | --- | --- |
| `wbc-sessions.json` | `GET /api/wbc/sessions` | `WbcSession[]` |
| `wbc-detail.json` | `GET /api/wbc/sessions/{sid}` | `WbcDetail` |
| `wbc-turns.json` | `GET /api/wbc/sessions/{sid}/turns` | `WbcTurnsPage` |
| `wbo-sessions.json` | `GET /api/wbo/sessions` | `WboSession[]` |
| `wbo-detail.json` | `GET /api/wbo/sessions/{sid}` | `WboDetail` |
| `wbo-panel.json` | `GET /api/wbo/sessions/{sid}/panel` | `WboPanel` |
| `wbo-models.json` | `GET /api/wbo/sessions/{sid}/models` | `WboModels` |
| `wbo-context.json` | `PUT /api/wbo/sessions/{sid}/context` | `WboContext` |
| `agents-links.json` | `GET /api/agents/links` | `AgentLinks` |
| `agents-team.json` | `GET /api/agents/team/{manager}` (its `progress` block is the planned Jev field, hand-added) | `TeamAnswer` |
| `side.json` | `GET /api/me/side` | `SidePrefs` |
| `release.json` | `GET /api/public/m/app.json`, as `parseRelease` reads it | `Release` |
| `bus.json` | one record of the account's bus stream (`acct/<id>/bus`, S2) | `BusEvent` |

`manifest.json` says which file is checked against which type (and where in the file).

## How they were taken

A session for the test account was made in its own database (the app's `x-workbench-session` header carries it;
it was never printed, kept in a `0600` file, and ended afterwards). The account had no Claude Code sessions and
no team of its own, so mock data was written **only** under that account - an OpenCode session and its computer,
a Claude Code bridge with a few messages, a link between them and one task - and read back through the real API,
so every field is the server's own serializer's. That mock data was deleted afterwards.

The Claude Code turns are the one exception: they live in the Claude pool gateway, which holds the person's own
runs, and writing a fake session there would put it in the pool's real accounting. `wbc-turns.json` is what
`GET /api/wbc/sessions/{sid}/turns` answers for a synthetic request log - the same endpoint function, the same
serializer - and it says so in the manifest.

## What was scrubbed

Account id, name, e-mail, host name and home directories; every mock session/message/bridge id is a stand-in
(`ses_fixture…`, `ask_fixture…`). No token, cookie or secret is in any file. Release notes in `release.json`
are the app's public changelog.

## Checking again

```
node scripts/contract-check.ts          # the table; exits 1 when something the app reads is missing or changed
npx jest src/api/__tests__/contract.test.ts
```

To refresh a fixture, take a new answer from the server, scrub it the same way, and keep the manifest's shape
entry as it is - or update the type first when the server really changed.

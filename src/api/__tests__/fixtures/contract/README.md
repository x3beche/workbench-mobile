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
| `agents-team.json` | `GET /api/agents/team/{manager}` (its `progress` block is a real Jev measurement from the live server, ids scrubbed) | `TeamAnswer` |
| `side.json` | `GET /api/me/side` | `SidePrefs` |
| `release.json` | `GET /api/public/m/app.json`, as `parseRelease` reads it | `Release` |
| `office-live.json` | `GET /api/office/live` (the director's layer and a measured task) | `OfficeLive` |
| `bus.json` | one record of the account's bus stream (`acct/<id>/bus`, S2) | `BusEvent` |

`manifest.json` says which file is checked against which type (and where in the file).

## How they were taken

A session for the test account was made in its own database (the app's `x-workbench-session` header carries it;
it was never printed, kept in a `0600` file, and ended afterwards). The account had no Claude Code sessions and
no team of its own, so mock data was written **only** under that account - an OpenCode session and its computer,
a Claude Code bridge with a few messages, a link between them and one task - and read back through the real API,
so every field is the server's own serializer's. That mock data was deleted afterwards.

The team answer's `progress` block is real too: it is what the live server's own
`task_progress` loop wrote on a task (`percent` 17, `spread` 15.4, `eta` "15-60m",
`at` an epoch in seconds, `model` "typesafe/jev"), read back through the Team
endpoint - the shape `TaskProgress` has read since 6d21ce5, now checked against a
real answer rather than a hand-added one.

The Claude Code turns are the one exception: they live in the Claude pool gateway, which holds the person's own
runs, and writing a fake session there would put it in the pool's real accounting. `wbc-turns.json` is what
`GET /api/wbc/sessions/{sid}/turns` answers for a synthetic request log - the same endpoint function, the same
serializer - and it says so in the manifest.

## The office's live answer

`office-live.json` is a real `/api/office/live` answer, taken the same way on the test account and the same day:
two OpenCode sessions written under it, with their computers (the server reads a bridge as connected when its
`seen` is under 45 s old), one open task carrying a Jev progress block - the account's own measurement shape,
`{percent, spread, eta, at, model}` - and a director row per agent (`office_moods.jev`, what
`backend/office_director.py` writes). So the answer carries the director's layer the app now reads: `by: "jev"`,
`confidence`, `mood: {name, level}`, `detail`, `needs_manager: true` with `bubble: "?"`, and `pose`.

That answer is also where the app's `OfficeTask.progress` was corrected: the server passes the task's
`TaskProgress` block through as it keeps it, not a bare percent, so the type reads a number *or* that block and
the card draws the "~" and the time left from it. The mock data was deleted afterwards (the office the server
builds for the account with it), as the sessions' own fixtures do.

## What was scrubbed

Account id, name, e-mail, host name and home directories; every mock session/message/bridge id is a stand-in
(`ses_fixture…`, `ask_fixture…`). In `office-live.json` every agent key is `wbo:ses_fixtureNN` and the names the
parallel agents' own fixtures had left on the account are replaced by plain work titles. No token, cookie or
secret is in any file. Release notes in `release.json` are the app's public changelog.

## Checking again

```
node scripts/contract-check.ts          # the table; exits 1 when something the app reads is missing or changed
npx jest src/api/__tests__/contract.test.ts
```

To refresh a fixture, take a new answer from the server, scrub it the same way, and keep the manifest's shape
entry as it is - or update the type first when the server really changed.

# Click tracking and sessions

Files: `tracker.ts`, `sessions.ts`.

## Events (`InsightEvent`)
- `view`: `{ type, t, sid, page, query?, vw, vh, from? }`
- `click`: as view, plus `x` (% width), `y` (page px), `docH`, `label`, `tag`, `href?`, `kind`, `section`, `sel`, `ex`, `ey` (% on element), `ew`, `eh`, `state?`, `ms` (since screen opened), `sy` (scroll depth %), `rage?`, `dead?`, `fx` (`navigated|changed|nothing`), `to?`
- `end`: `{ type, reason: 'ended'|'closed'|'idle'|'stopped' }`

Stored in `localStorage["<app>.insights.clicks"]` (last 3000). To collect from many browsers, pass `installTracker(cfg, { send })` with a function that POSTs batches; use `navigator.sendBeacon` on `pagehide`.

## Session lifecycle
- **Start:** counting starts when a `mainPages` path opens. Taps before that are dropped, not queued.
- **End:** a session ends when
  - the tab closes (`pagehide` writes `closed`; a reload withdraws it, because later events follow);
  - `tracker.endSession()` is called (the dock's End session button);
  - it sits idle for 30 minutes;
  - recording is switched off (`endSession('stopped')` before `uninstall()`).
- **Recording carries on:** the next session starts on the next main-page visit.
- **Dock indicator:** listen to `SESSION_EVENT` and read `tracker.state()` to show "● End session" or "Starts on home".

## Taps
- **Control detection:** `controlOf()` uses real controls first, otherwise the outermost element with a pointer cursor, so a click on a table row is recorded as that row.
- **Effect:** within 700 ms the tap is classified as navigated, changed or nothing. A new tap closes the previous watch, so effects aren't misattributed.
- **Rage:** the 3rd or later tap within 1 s and 40 px.
- **Dead:** a tap on something that isn't a control.

## Reading sessions
`buildSessions(events)` gives sessions newest first, each with:
- `steps` (views and taps in time order) and `pages` (the journey);
- `taps`, `problems` (rage, dead or did-nothing), and `ended`.

`sessionCsv(session)` exports one session.

Console: list sessions on the left (number, length, layout, how it ended, tags). The selected session shows:
- the journey chips;
- a step-by-step timeline (fold runs of pass-through views into one line);
- researcher notes with tags (Found it, Confused, Got lost, Slow, Bug, Worth a follow-up);
- a "Replay taps" drawer: screen viewer + ← → (see heatmap.md).

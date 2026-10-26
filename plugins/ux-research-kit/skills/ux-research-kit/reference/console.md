# Research console (generate in the project's UI)

The console is part of the research tools, not the product.

## Layout and dock
- **Routes:** `/research/*` or `#/console/*`, with their own layout: a top bar reading "Research console", tabs per tool, and "Back to <product>". Set `paused()` to true there.
- **Research dock:** a floating, draggable dock (position remembered, arrow keys move it). It holds:
  - the session indicator ("● End session" / "Starts on home");
  - Comment and All comments;
  - the design variant name, when one is active;
  - a version or theme switch, if the project has one;
  - a link to the console.

  Hide the dock inside iframes and on heatmap URLs.

## Screens
- **Sessions:** a recording switch (switching off calls `endSession('stopped')`), refresh, delete all, the session list and timeline, notes and tags, CSV export, a heatmap tab, and the replay drawer.
- **Usability tests:** see usability-tests.md.
- **5-second tests:** see five-second.md.
- **Fake doors:** see fake-doors.md.
- **Eye tracking:** see eye-tracking.md.
- **Design tokens:** see design-tokens.md.

Use the project's own components (tables, cards, switches, dialogs) so the console fits the codebase.

## Collecting from many browsers
Everything defaults to localStorage, which means one browser.

To aggregate, add endpoints that accept batches:
- `installTracker(cfg, { send })`;
- POSTs of door events, 5-second results and gaze points.

Each endpoint should answer `{ configured: boolean, scope }`, so the console can say where its data comes from ("Server · production" vs "This browser only"). The privacy rules still apply server-side.

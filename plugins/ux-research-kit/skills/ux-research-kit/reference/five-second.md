# 5-second tests

File: `five-second.ts`.

## Test
`{ id, name, prompt, page, query?, seconds (3–15), target?: { sel, label } }`.

## Participant flow
Participant link: `<page>?fivesec=<id>`; `installResearch` starts it once per page load.
1. A cover hides the screen and shows the prompt, with "Show the screen".
2. The screen appears for `seconds`, with a countdown bar and a transparent click catcher.
3. The first click is resolved to the element underneath (`elementsFromPoint`) and recorded with its position on the element. A timeout records `missed`.

## Results (console screen to generate)
- **Numbers:** participants, % clicked in time, median time to first click, % on the target (if one is set).
- **First clicks:** what was clicked first, by label, with counts, marking the target.
- **Screen viewer:** shows the first clicks via `fiveSecAsClicks()`. With a target, use elements mode: green is on target, red is elsewhere.
- **Editor:** name, prompt, seconds, and screen plus target picked in the screen viewer's pick mode; "Copy participant link"; "Clear results".

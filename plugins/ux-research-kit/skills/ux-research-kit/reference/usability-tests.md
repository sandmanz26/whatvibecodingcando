# Usability tests (generate)

Timed, task-based tests.

## Data
A test is `{ id, name, intro, tasks: [{ id, prompt, startPage, success: { kind: 'page', page } | { kind: 'element', sel, label, page }, limitSec }] }`.

## Participant flow
Participant link: `?test=<id>`.
1. Intro, then an optional nickname.
2. For each task: a "Ready" card, then the task runs with a small floating timer and the prompt.
3. A task ends with success (the page is reached or the target element tapped), timeout, or "give up".
4. Each task records the outcome, time, the pages visited, and taps. Taps are `{ t, page, x %, y px, docH, vw, label, sel, ex, ey, hit }`, and the first tap is marked correct when it moves toward the target.
5. The run survives a reload (sessionStorage).

## Results
- Per task: success rate, median time, timeouts, gave up, direct success (no backtracking), and first-tap correctness, with the first taps listed by label.
- Per participant: rows expand into a per-task timeline, with replay through the screen viewer.
- The task map uses the heatmap with the task's taps; misses are drawn as idle.
- The editor uses the screen viewer's pick mode for the target element and lets a page rule end in `*` (any page below it).

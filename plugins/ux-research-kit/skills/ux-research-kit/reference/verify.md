# Verification checklist

Run the project's typecheck and build first. Then, in a real browser (Playwright with Chromium is fine), check each module below.

## Tracking
1. Clear storage and switch tracking on. Open a non-main page and tap: **nothing is stored**.
2. Open the main page: the dock shows "● End session".
3. Tap a nav link, a filter (query changes), and a clickable table row. The row is recorded with its label, not "(not a control)".
4. Reload: the same session continues.
5. End the session, then tap: nothing is stored until the main page is opened again.

## Replay
For each recorded tap, open `<page>?<query>&heatmap&el=<sel>&dot=x,y,ex,ey` at the tap's `vw`×`vh`. The dot's centre must sit on the same control (check with `elementsFromPoint`), and at the same `ex` % within it.

## Heatmap
- `?heatmap=elements` shows a box with a count on each tapped element.
- Taps from another layout bucket are not drawn.

## Fake door
1. A live door appears.
2. Clicking it shows the note, and the page does not navigate.
3. The events are `seen,click`.

## 5-second test
- With the participant link, a click on the target saves `hit=true` with a time.
- Waiting saves `missed`.

## Design
1. Save a design with a changed primary colour and radius. The computed styles change.
2. Dark mode uses the dark tokens.
3. Turning it off removes the `<style>` and `data-uilib`.

## Eye tracking
Use a fake camera. Check the consent card, then "Looking for your face…", then the dot retry message. Cancel must stop the camera.

## Console errors
None, apart from MediaPipe's TensorFlow Lite info line.

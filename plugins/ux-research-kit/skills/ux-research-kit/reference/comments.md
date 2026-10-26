# Comments (generate)

Comments are reviewer notes placed anywhere on any screen, research console included. They aren't tied to elements, and there are no replies or statuses: a comment is a note on a spot.

## Data
`{ id, page, x %, y %, vw, vh, scrollY, text, createdAt, updatedAt, author }`. Store them in `<app>.comments` (max 500 notes, 4000 chars each).

## Placing and reading
- **Place:** a "Comment" button in the research dock, the **C** key (ignored inside fields), or a round floating button starts placing.
  - The cursor becomes a crosshair, with the hint "Click anywhere to leave a comment · Esc to cancel".
  - The click drops a numbered pin and opens a card with a textarea. Only the author can edit their own comment.
- **List:** "All comments" shows page, text, author and time. Choosing one goes to that page, scrolls to the spot, pings it and opens the card.
- **Draw:** pins on the current page sit at `x%` of the width and `y% * vh + scrollY` of the page. Hide them during usability-test runs.
- **Tracking:** pause click tracking while placing (`html[data-commenting="on"]`) and mark all comment UI with `data-research-ui`.

## Moving comments
Export and import a human-readable .txt that is lossless (one block per comment, plus a JSON line with the fields), so notes move between deployments.

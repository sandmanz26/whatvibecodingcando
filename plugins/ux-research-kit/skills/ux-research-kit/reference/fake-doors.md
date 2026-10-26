# Fake doors

File: `fake-doors.ts`.

## Door
A door has `{ id, name, page, sel, anchorLabel, mode: 'existing'|'new', label, message, live }`.
- `existing`: the picked element becomes the door. While live, its own action is blocked.
- `new`: a button with `label` is inserted after the picked element. It copies the neighbour's classes so it looks native, and is re-inserted if the framework re-renders.

## Runtime
`installFakeDoors(cfg)`. A click on a live door:
- is stopped before the app sees it (capture listener + `stopPropagation`); the click tracker still records it;
- records `click` and opens a "Coming soon" note with `message`. Pass `onOpen` to use the project's own dialog component.

"Seen" is counted once per page visit, when the door is at least half on screen (IntersectionObserver). Nothing is counted inside an iframe or on heatmap URLs.

## Results (console screen to generate)
A table with one row per door: name, where (page link), live switch, saw it (tabs), clicked (tabs), click rate = clicked ÷ saw it, total clicks, edit, reset counts, delete.

The editor has:
- a name ("What it measures");
- the element, picked in the screen viewer;
- the kind (new button / this element);
- the button text and the message.

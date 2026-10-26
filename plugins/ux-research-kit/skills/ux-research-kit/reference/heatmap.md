# Heatmaps and tap replay

File: `heatmap.ts`. `mountHeatmap(cfg, { mode, clicks, gaze, dot, focus })`, or `heatmapFromUrl(cfg, …)`. Both read these URL parameters:
- `?heatmap`: dots;
- `?heatmap=elements`: per-element boxes with counts, coloured by the share of taps that did nothing (green < 20%, amber < 50%, red ≥ 50%);
- `?heatmap=gaze`: soft gaze areas;
- `&el=<selector>`: ring this element and scroll to it;
- `&dot=x,y,ex,ey`: draw one replayed tap.

## Rules that keep it accurate
- **Anchor dots to elements:** draw a tap on its element at `ex`/`ey` and re-measure on scroll, resize and every second. Page coordinates drift with sticky sidebars, different widths and renamed menus. Fall back to `x`%/`y` (grey) only when the element is gone.
- **Same page, same layout:** only draw taps from the same page and the same layout bucket (mobile < 640, tablet < 1024, desktop).
- **Exact replay:** replay one tap at the participant's own window size (`vw` × `vh`) and with their safe query, so the same rows are on screen.
- **Scrolling:** inside an iframe, scroll with `window.scrollTo`. `scrollIntoView` scrolls the parent page too.

## Screen viewer (console component to generate)
An iframe of the app, same origin, at a device width (mobile 390, tablet 820, desktop 1280) or an exact size, scaled to fit. Its URL is `<page>?<query>&heatmap…&embed`, and later changes are made through `contentWindow.location.hash` (or the router), not by reloading.

The overlay posts `{ type: '<app>:heatmap', count, missing, unit, page, layout }` to the parent, which shows "N taps on /page at desktop width".

A **pick** mode serves fake doors, 5-second targets and usability tasks:
- hover outlines the element under the pointer and a click returns `describeTarget(el)` → `{ sel, label }` with the current path;
- a "Navigate" toggle lets the researcher reach other screens first.

# Design token simulation

File: `design-tokens.ts`.

## Format
The format follows W3C Design Tokens (DTCG):
- a token is any object with `$value` (optional `$type`, `$description`), and groups nest freely;
- **the token's own name (the last key) is the CSS variable it sets**: `{ "color": { "primary": { "$value": "#6750a4" } } }` → `--primary`;
- the top-level keys are scopes: `light`, `dark`, and any `EXTRA_SCOPES` (selector → an area that redefines variables, e.g. `{ v2: '.v2' }`).

## Functions
- `baseline()` reads the project's own tokens from its stylesheets: `:root` → light, the dark selector → dark, and extra scopes by selector. This is the starting JSON.
- `toCss(doc, baseline)` emits only the changed tokens:
  - a light token that dark mode doesn't redefine (radius, fonts) applies in both modes;
  - themed tokens follow `THEME_ATTR` and `prefers-color-scheme`;
  - selectors carry `html:root` / a doubled class, so they beat the originals.
- `validate(text)` returns plain-language errors: bad JSON, unknown scope, a name that can't be a CSS variable, a value containing `; { }`.
- `merge`, `changes` and `flatten` are helpers for the editor.
- `installDesignLayer(cfg, presetCss)` applies the saved design (`<app>.design`) and sets `html[data-uilib]`. Inside an iframe it also listens for `{ type: '<app>:design', design }` from the parent and answers `:ready`, so the console previews without saving.

## Console screen (to generate)
- **UI library cards:** choosing one loads the baseline merged with that preset's tokens into the editor.
- **Quick edits:** a colour picker or range for the main roles (primary, on-primary, accent, page, surface, text, control and card radius). Each edits the JSON.
- **JSON editor:** with format, reset, download and upload buttons. An upload lays partial files over the baseline.
- **Live preview:** the screen viewer in live mode with the design posted to it, with screen and device switches.
- **Apply:** "Apply in this browser" saves it, so a usability test can run on the variant; "Turn off" removes it. The dock shows the active look's name.
- **What changes:** a table of token, scope, from, to, with swatches.

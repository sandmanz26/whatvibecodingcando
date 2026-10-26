# UI-library looks

`ui-presets.ts` holds role palettes for Material 3, Ant Design, shadcn/ui and Bootstrap 5 (light and dark). `presetDoc(id, roleToCssVar)` turns one into a design document for the project.

These are **imitations of each library's look on the project's own components**, not the libraries themselves. Say so in the UI. Swapping in the real library is a code migration, not a simulation.

## Component rules to write per look
Scope every rule under `html[data-uilib='<id>']`, target the project's real component classes or data attributes, and use `var(--primary)` (not hard-coded colours) so token edits still apply.

| | Material 3 | Ant Design | shadcn/ui | Bootstrap 5 |
|---|---|---|---|---|
| Button | 20 px pill, 36–40 px high, weight 500, no shadow until hover | 6 px, 32 px, weight 400, hover turns border/text primary | 6 px, 36 px, weight 500, 1 px border + xs shadow | 6 px, 38 px, weight 400, solid; focus glow 0.25rem primary 25% |
| Input | outlined, 4 px corners, 40 px, focus = 1 px inset primary | 32 px, hover border primary, focus 2 px primary 10% ring | 36 px, focus ring 2 px offset in zinc-400 | 38 px, focus border primary-50%, 0.25rem glow |
| Chip / tag | 8 px corners, 32 px, selected = secondary container (#e8def8) | 4 px tag, 24 px, grey fill | 6 px, medium weight | pill, selected = primary |
| Segmented | outlined pill, dividers, selected = secondary container | grey track, white raised thumb | muted track, raised white thumb | button group outlined in primary |
| Switch | 52×32 track with 2 px outline, thumb grows when on | 44×22, grey off / primary on | 44×24 | 32×16 outlined, small thumb |
| Tabs | 3 px primary indicator under the label, label turns primary | 2 px primary ink bar | pill tabs in a muted track | bordered "folder" tabs |
| Card | filled tonal (surface-container), no border | 8 px, 1 px #f0f0f0 border, no shadow | 12 px, 1 px border, xs shadow | 8 px, 1 px rgba(0,0,0,.175) border |
| Nav item | 28 px pill, active = secondary container | 8 px, active light blue + primary text | active muted fill | active solid primary, white text |
| Dialog | 28 px corners, surface-container-high | 8 px | 12 px, border | 8 px |

## Example
A complete working example against one app's classes (`.btn`, `.card`, `.input`, `.chip`, `.seg`, `.switch`, `.tabs`, `.nav-item`, `.badge`, `.modal`) is in `ui-presets-example.ts` next to this file.

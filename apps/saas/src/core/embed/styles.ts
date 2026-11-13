/** The widget's CSS, injected into its shadow root. Nothing here can affect the host page. */
export const CSS = `
:host { all: initial; }
.vc {
  --vc-accent: #e8590c;
  --vc-ink: #1f1f1f; --vc-ink-2: #5b5b5b; --vc-line: #e3e3e3; --vc-bg: #ffffff; --vc-soft: #f4f4f4; --vc-field: #ffffff; --vc-hover: #c9c9c9;
  font: 13.5px/1.45 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; color: var(--vc-ink);
  -webkit-font-smoothing: antialiased;
}
.vc.dark { --vc-ink: #f1f1f1; --vc-ink-2: #a9a9a9; --vc-line: #393939; --vc-bg: #1d1d1d; --vc-soft: #2a2a2a; --vc-field: #141414; --vc-hover: #5a5a5a; color-scheme: dark; }
.vc *, .vc *::before, .vc *::after { box-sizing: border-box; }
.vc button { font: inherit; color: inherit; cursor: pointer; }
.vc button:disabled { cursor: default; opacity: .45; }
.vc textarea, .vc input { font: inherit; color: var(--vc-ink); }
.vc p { margin: 0; }

.vc-dock { position: fixed; bottom: 18px; right: 18px; z-index: 2147483000; display: flex; gap: 6px; align-items: center; padding: 6px; border-radius: 999px; background: #1c1c1c; box-shadow: 0 8px 28px rgba(0,0,0,.28); }
.vc.left .vc-dock { right: auto; left: 18px; }
/* Many tools on a phone: the dock stays on screen and scrolls sideways instead of running off it. */
.vc-dock { max-width: calc(100vw - 24px); box-sizing: border-box; overflow-x: auto; overscroll-behavior: contain; scrollbar-width: none; }
.vc-dock::-webkit-scrollbar { display: none; }
.vc-dock > * { flex-shrink: 0; }
@media (max-width: 480px) { .vc-dock { bottom: 12px; right: 12px; } .vc.left .vc-dock { left: 12px; } }
.vc-btn { display: inline-flex; align-items: center; gap: 6px; height: 30px; padding: 0 12px; border-radius: 8px; border: 1px solid var(--vc-line); background: var(--vc-bg); font-weight: 550; font-size: 13px; white-space: nowrap; }
.vc-btn:hover:not(:disabled) { border-color: var(--vc-hover); }
.vc-btn.primary { background: var(--vc-accent); border-color: transparent; color: #fff; }
.vc-btn.danger { background: #c92a2a; border-color: transparent; color: #fff; }
.vc-dock .vc-btn { border-radius: 999px; height: 34px; padding: 0 14px; }
.vc-dock .vc-btn.on { background: #fff; color: #1c1c1c; }
.vc-icon { display: inline-grid; place-items: center; width: 26px; height: 26px; border: 0; border-radius: 6px; background: transparent; color: var(--vc-ink-2); position: relative; }
.vc-icon:hover { background: var(--vc-soft); color: var(--vc-ink); }
.vc-icon.sm { width: 20px; height: 20px; margin-left: auto; }
.vc-icon.dock { width: 34px; height: 34px; border-radius: 999px; color: #fff; }
.vc-icon.dock:hover { background: rgba(255,255,255,.12); color: #fff; }
.vc-count { position: absolute; top: -2px; right: -2px; min-width: 17px; height: 17px; padding: 0 4px; border-radius: 9px; background: var(--vc-accent); color: #fff; font-size: 10.5px; font-weight: 700; display: grid; place-items: center; }

.vc-pin { position: fixed; z-index: 2147482990; transform: translate(-50%, -50%); width: 26px; height: 26px; padding: 0; border-radius: 50%; border: 2px solid #fff; background: var(--vc-accent); color: #fff; font-size: 11.5px; font-weight: 700; line-height: 1; display: grid; place-items: center; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.vc-pin.st-ongoing { background: #1971c2; }
.vc-pin.st-completed { background: #2f9e44; }
.vc-pin.sel { box-shadow: 0 0 0 3px rgba(0,0,0,.25), 0 2px 8px rgba(0,0,0,.3); }
.vc-pin.lost { opacity: .65; border-style: dashed; }
.vc-pin.draft { background: #1c1c1c; pointer-events: none; }

.vc-card { position: fixed; z-index: 2147483001; background: var(--vc-bg); border: 1px solid var(--vc-line); border-radius: 12px; box-shadow: 0 12px 40px rgba(0,0,0,.22); padding: 12px; display: flex; flex-direction: column; gap: 8px; max-height: calc(100vh - 16px); overflow-y: auto; }
.vc-card.shake { animation: vc-shake .35s; }
@keyframes vc-shake { 20%, 60% { transform: translateX(-6px); } 40%, 80% { transform: translateX(6px); } }
.vc-card-head { display: flex; align-items: center; gap: 8px; }
.vc-card textarea, .vc-panel input, .vc-name input { width: 100%; border: 1px solid var(--vc-line); border-radius: 8px; padding: 7px 9px; background: var(--vc-field); resize: vertical; outline: none; }
.vc-card textarea:focus, .vc-name input:focus { border-color: var(--vc-accent); box-shadow: 0 0 0 3px color-mix(in srgb, var(--vc-accent) 18%, transparent); }
.vc-row { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.vc-grow { flex: 1; }
.vc-stack { display: flex; flex-direction: column; gap: 6px; }
.vc-name { display: inline-flex; align-items: center; gap: 6px; color: var(--vc-ink-2); font-size: 12.5px; }
.vc-name input { width: 120px; height: 28px; padding: 0 8px; }
.vc-meta { display: flex; align-items: center; gap: 4px; font-size: 12px; color: var(--vc-ink-2); }
.vc-meta b { color: var(--vc-ink); font-weight: 600; }
.vc-text { white-space: pre-wrap; overflow-wrap: anywhere; }
.vc-badge { display: inline-flex; align-items: center; height: 20px; padding: 0 7px; border-radius: 999px; font-size: 11px; font-weight: 650; background: #fff1e8; color: #b64a0b; }
.vc-badge.st-ongoing { background: #e7f1fc; color: #155a9c; }
.vc-badge.st-completed { background: #e6f6e9; color: #237032; }
.vc-replies { list-style: none; margin: 0; padding: 0 0 0 10px; border-left: 2px solid var(--vc-line); display: flex; flex-direction: column; gap: 8px; }
.vc-confirm { display: flex; flex-direction: column; gap: 6px; padding: 8px; border-radius: 8px; background: #fff5f5; color: #a61e1e; font-size: 12.5px; }
.vc-done { font-size: 12.5px; color: #237032; }
.vc-lost { display: flex; gap: 4px; align-items: center; font-size: 12px; color: var(--vc-ink-2); }

.vc-overlay { position: fixed; inset: 0; z-index: 2147482995; cursor: crosshair; background: rgba(0,0,0,.04); }
.vc-hint { position: fixed; top: 14px; left: 50%; transform: translateX(-50%); padding: 7px 14px; border-radius: 999px; background: #1c1c1c; color: #fff; font-size: 12.5px; font-weight: 550; pointer-events: none; }

.vc-panel { position: fixed; top: 12px; right: 12px; bottom: 74px; width: min(340px, calc(100vw - 24px)); z-index: 2147483002; background: var(--vc-bg); border: 1px solid var(--vc-line); border-radius: 14px; box-shadow: 0 12px 40px rgba(0,0,0,.22); padding: 12px; display: flex; flex-direction: column; gap: 10px; }
.vc.left .vc-panel { right: auto; left: 12px; }
.vc-seg { display: flex; padding: 2px; border-radius: 8px; background: var(--vc-soft); }
.vc-seg button { flex: 1; height: 28px; border: 0; border-radius: 6px; background: transparent; font-size: 12.5px; font-weight: 550; color: var(--vc-ink-2); }
.vc-seg button[aria-pressed='true'] { background: var(--vc-field); color: var(--vc-ink); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.vc-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.vc-chips button { height: 26px; padding: 0 9px; border-radius: 999px; border: 1px solid var(--vc-line); background: var(--vc-field); font-size: 12px; }
.vc-chips button span { opacity: .6; margin-left: 2px; }
.vc-chips button[aria-pressed='true'] { background: var(--vc-ink); color: var(--vc-bg); border-color: transparent; }
.vc-items { list-style: none; margin: 0; padding: 0; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 6px; }
.vc-items button { width: 100%; text-align: left; display: flex; flex-direction: column; gap: 4px; padding: 9px 10px; border: 1px solid var(--vc-line); border-radius: 10px; background: var(--vc-field); }
.vc-items button:hover { border-color: var(--vc-hover); }
.vc-snippet { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow-wrap: anywhere; }
.vc-muted { color: var(--vc-ink-2); font-size: 12px; }
.vc-empty { color: var(--vc-ink-2); font-size: 13px; padding: 12px 2px; }
.vc-where { margin: 0; font-size: 11.5px; color: var(--vc-ink-2); }

.vc-toast { position: fixed; bottom: 70px; left: 50%; transform: translateX(-50%); z-index: 2147483003; padding: 8px 14px; border-radius: 10px; background: #1c1c1c; color: #fff; font-size: 13px; box-shadow: 0 8px 24px rgba(0,0,0,.25); max-width: calc(100vw - 32px); }
.vc-toast.error { background: #a61e1e; }

.vc-preview { position: fixed; top: 12px; left: 12px; z-index: 2147483004; display: flex; align-items: center; gap: 8px; padding: 6px 6px 6px 12px; border-radius: 999px; background: #5f3dc4; color: #fff; font-size: 12.5px; font-weight: 600; box-shadow: 0 6px 20px rgba(0,0,0,.25); }
.vc-preview button { height: 24px; padding: 0 10px; border: 0; border-radius: 999px; background: rgba(255,255,255,.2); color: #fff; font-size: 12px; font-weight: 600; }

@media (prefers-reduced-motion: reduce) { .vc-card.shake { animation: none; } }

/* reviewer tools: Inspect, Design system check, Design tokens */
.vc-dock .vc-sep { width: 1px; height: 22px; background: rgba(255,255,255,.18); margin: 0 2px; }
.vc-icon.dock.on { background: #fff; color: #1c1c1c; }
.vc-hint-bar { display: flex; align-items: center; gap: 10px; pointer-events: auto; z-index: 2147483003; }
.vc-hint-bar button { display: inline-flex; align-items: center; gap: 4px; height: 22px; padding: 0 8px; border: 0; border-radius: 999px; background: rgba(255,255,255,.18); color: #fff; font-size: 12px; font-weight: 600; }
.vc-ibox { position: fixed; z-index: 2147482996; pointer-events: none; outline: 2px solid #1971c2; outline-offset: -1px; background: rgba(25,113,194,.08); }
.vc-ibox.pinned { outline-color: var(--vc-accent); background: color-mix(in srgb, var(--vc-accent) 10%, transparent); }
.vc-ibox span { position: absolute; top: -20px; left: -2px; padding: 1px 6px; border-radius: 4px; background: #1971c2; color: #fff; font-size: 11px; font-weight: 600; white-space: nowrap; }
.vc-ibox.pinned span { background: var(--vc-accent); }
.vc-insp { gap: 6px; }
/* While hovering, the panel lets the pointer through to the page below it. */
.vc-insp.through { pointer-events: none; }
.vc-mono { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.vc-trunc { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; }
.vc-rows { margin: 0; display: flex; flex-direction: column; gap: 5px; }
.vc-rows > div { display: grid; grid-template-columns: 92px 1fr; gap: 8px; align-items: start; }
.vc-rows dt { color: var(--vc-ink-2); font-size: 12px; }
.vc-rows dd { margin: 0; display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: center; }
.vc-val { display: inline-flex; align-items: center; gap: 6px; min-width: 0; }
.vc-val i { width: 14px; height: 14px; border-radius: 4px; border: 1px solid rgba(0,0,0,.18); flex: none; }
.vc-ok { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; color: #237032; }
.vc-bad { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; color: #c92a2a; }
.vc-sum { font-size: 12px; font-weight: 600; padding: 6px 8px; border-radius: 8px; background: #e6f6e9; color: #237032; }
.vc-sum.bad { background: #fff5f5; color: #a61e1e; }
.vc-box { display: flex; flex-direction: column; gap: 6px; padding: 10px; border: 1px solid var(--vc-line); border-radius: 10px; background: var(--vc-soft); }
.vc-check { display: flex; gap: 8px; align-items: flex-start; font-size: 12.5px; }
.vc-check input { width: auto; margin-top: 2px; }
.vc-drop { height: 44px; justify-content: center; border-style: dashed; }
.vc-toks li { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; align-items: center; padding: 4px 2px; border-bottom: 1px solid var(--vc-line); }

/* studies: what a participant sees */
.vc-scrim { position: fixed; inset: 0; z-index: 2147483005; background: rgba(15,15,15,.45); display: grid; place-items: center; padding: 16px; }
.vc-cover { position: fixed; inset: 0; z-index: 2147483005; background: #f4f4f4; display: grid; place-items: center; padding: 16px; }
.vc-modal { width: min(440px, 100%); max-height: calc(100vh - 32px); overflow-y: auto; background: var(--vc-bg); color: var(--vc-ink); border-radius: 16px; box-shadow: 0 20px 60px rgba(0,0,0,.3); padding: 22px; display: flex; flex-direction: column; gap: 10px; font: 14px/1.5 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
.vc-modal h2 { margin: 0; font-size: 20px; line-height: 1.25; }
.vc-modal p { margin: 0; }
.vc-kicker { font-size: 11.5px; font-weight: 700; text-transform: uppercase; letter-spacing: .06em; color: var(--vc-accent); }
.vc-list { list-style: none; margin: 4px 0; padding: 0; display: flex; flex-direction: column; gap: 6px; font-size: 13px; }
.vc-list li { display: flex; gap: 8px; align-items: flex-start; }
.vc-list svg { flex: none; margin-top: 3px; color: #237032; }
.vc-q { display: flex; flex-direction: column; gap: 4px; font-weight: 600; font-size: 13px; }
.vc-q textarea { font: inherit; font-weight: 400; border: 1px solid var(--vc-line); border-radius: 8px; padding: 7px 9px; resize: vertical; }
.vc-taskbar { position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2147483004; display: flex; align-items: center; gap: 10px; max-width: calc(100vw - 24px); padding: 6px 6px 6px 14px; border-radius: 999px; background: #1c1c1c; color: #fff; box-shadow: 0 8px 28px rgba(0,0,0,.3); font: 13px/1.3 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
.vc-taskbar.small { padding: 6px 14px; gap: 6px; font-weight: 700; }
.vc-taskbar .vc-kicker { color: #ffb38a; }
.vc-taskprompt { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; min-width: 0; max-width: 46vw; font-weight: 600; }
.vc-clock { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; opacity: .85; }
.vc-taskbar .vc-btn { height: 30px; border-radius: 999px; }
/* the reviewer's heatmap over the page */
.vc-heat { position: fixed; inset: 0; z-index: 2147482994; pointer-events: none; width: 100vw; height: 100vh; }
.vc-heatpanel { top: auto; bottom: 74px; height: auto; max-height: 60vh; }
.vc-legend { height: 8px; border-radius: 4px; }
.vc-q select, .vc-q input[type=range] { font: inherit; }
.vc-door { position: fixed; z-index: 2147482997; height: 30px; padding: 0 12px; border-radius: 999px; border: 0; background: var(--vc-accent); color: #fff; font: 600 13px/1 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 4px 14px rgba(0,0,0,.2); cursor: pointer; }
.vc-door span { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; background: rgba(255,255,255,.25); padding: 2px 5px; border-radius: 4px; }
.vc-cambox { position: fixed; width: 1px; height: 1px; overflow: hidden; opacity: 0; pointer-events: none; left: 0; top: 0; }
.vc-cam { width: 320px; height: 240px; }
.vc-calib { position: fixed; inset: 0; z-index: 2147483005; background: rgba(244,244,244,.96); }
.vc-dot { position: fixed; width: 26px; height: 26px; margin: -13px 0 0 -13px; border-radius: 50%; border: 4px solid #fff; background: var(--vc-accent); box-shadow: 0 0 0 3px var(--vc-accent), 0 4px 14px rgba(0,0,0,.3); cursor: pointer; animation: vc-pulse 1.2s ease-in-out infinite; }
@keyframes vc-pulse { 50% { transform: scale(.75); } }
.vc-seg { display: flex; padding: 2px; border-radius: 8px; background: var(--vc-soft); }
.vc-seg button { flex: 1; height: 26px; border: 0; border-radius: 6px; background: transparent; font-size: 12px; font-weight: 550; color: var(--vc-ink-2); }
.vc-seg button[aria-pressed='true'] { background: var(--vc-field); color: var(--vc-ink); box-shadow: 0 1px 2px rgba(0,0,0,.08); }
.vc-ab { position: fixed; z-index: 2147482991; transform: translate(-50%, -50%); width: 24px; height: 24px; border-radius: 6px; background: #5f3dc4; color: #fff; font: 800 12px/24px system-ui, sans-serif; text-align: center; pointer-events: none; box-shadow: 0 2px 8px rgba(0,0,0,.3); }
.vc-ver { display: inline-block; margin-left: 6px; padding: 0 6px; border-radius: 4px; background: var(--vc-soft); color: var(--vc-ink-2); font-size: 11px; font-weight: 600; }
.vc-audio { width: 100%; height: 36px; }
.vc-lostface { color: #ffb38a; opacity: 1; font-weight: 700; }
`

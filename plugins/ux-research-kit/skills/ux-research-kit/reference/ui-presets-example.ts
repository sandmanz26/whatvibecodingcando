// Example only: the component rules Skillhouse uses for each look. Adapt class names to the target project.
/**
 * UI library looks for the classic app: each is a set of tokens plus component rules that
 * restyle Skillhouse's own components (buttons, inputs, chips, cards, tabs, switches, tables)
 * the way that library draws them. They imitate the look; they don't load the library's code.
 * Component rules apply under html[data-uilib="<id>"]; the v2 design keeps its own art direction.
 */
import type { DesignDoc } from './tokens'

export interface Preset {
  id: string
  name: string
  note: string
  tokens: DesignDoc
  css: string
}

const t = (vars: Record<string, string>) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, { $value: v }]))

export const PRESETS: Preset[] = [
  {
    id: 'skillhouse',
    name: 'Skillhouse',
    note: 'The app’s own design: quiet neutrals, near-black primary, 6–14 px corners.',
    tokens: {},
    css: '',
  },
  {
    id: 'material',
    name: 'Material 3',
    note: 'Tonal purple, pill buttons and chips, filled tonal cards, outlined fields with 4 px corners.',
    tokens: {
      light: {
        color: t({ page: '#fef7ff', surface: '#fffbfe', 'surface-2': '#f3edf7', 'surface-3': '#ece6f0', sunken: '#f7f2fa', ink: '#1d1b20', 'ink-2': '#49454f', 'ink-3': '#79747e', line: '#cac4d0', 'line-strong': '#79747e', primary: '#6750a4', 'primary-ink': '#ffffff', accent: '#6750a4', 'accent-wash': 'rgba(103, 80, 164, 0.12)', focus: '#6750a4' }),
        radius: t({ 'r-sm': '20px', r: '12px', 'r-lg': '16px' }),
        font: t({ font: "Roboto, 'Inter Variable', system-ui, sans-serif" }),
        shadow: t({ 'shadow-sm': 'none', shadow: '0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)' }),
      },
      dark: {
        color: t({ page: '#141218', surface: '#1d1b20', 'surface-2': '#2b2930', 'surface-3': '#36343b', sunken: '#0f0d13', ink: '#e6e0e9', 'ink-2': '#cac4d0', 'ink-3': '#938f99', line: '#49454f', 'line-strong': '#938f99', primary: '#d0bcff', 'primary-ink': '#381e72', accent: '#d0bcff', 'accent-wash': 'rgba(208, 188, 255, 0.14)' }),
      },
    },
    css: `
html[data-uilib='material'] .btn { border-radius: 20px; height: 36px; padding: 0 20px; font-weight: 500; letter-spacing: .01em; border-color: var(--line-strong); }
html[data-uilib='material'] .btn.sm { height: 30px; padding: 0 14px; }
html[data-uilib='material'] .btn.icon { width: 36px; padding: 0; } html[data-uilib='material'] .btn.sm.icon { width: 30px; }
html[data-uilib='material'] .btn.primary { box-shadow: none; }
html[data-uilib='material'] .btn.primary:hover { opacity: 1; box-shadow: 0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15); }
html[data-uilib='material'] .card { border: 0; background: var(--surface-2); box-shadow: none; }
html[data-uilib='material'] .input, html[data-uilib='material'] .select, html[data-uilib='material'] .textarea { border-radius: 4px; height: 40px; border-color: var(--line-strong); background: transparent; }
html[data-uilib='material'] .input:focus, html[data-uilib='material'] .select:focus, html[data-uilib='material'] .textarea:focus { box-shadow: inset 0 0 0 1px var(--primary); border-color: var(--primary); }
html[data-uilib='material'] .chip { border-radius: 8px; height: 32px; border-color: var(--line-strong); }
html[data-uilib='material'] .chip[aria-pressed='true'] { background: #e8def8; color: #1d192b; }
html[data-uilib='material'][data-theme='dark'] .chip[aria-pressed='true'] { background: #4a4458; color: #e8def8; }
html[data-uilib='material'] .seg { border-radius: 20px; padding: 0; border-color: var(--line-strong); background: transparent; overflow: hidden; }
html[data-uilib='material'] .seg button { border-radius: 0; height: 32px; padding: 0 14px; }
html[data-uilib='material'] .seg button + button { border-left: 1px solid var(--line-strong); }
html[data-uilib='material'] .seg button[aria-pressed='true'] { background: #e8def8; color: #1d192b; box-shadow: none; }
html[data-uilib='material'] .switch { width: 52px; height: 32px; background: var(--surface-3); box-shadow: inset 0 0 0 2px var(--line-strong); }
html[data-uilib='material'] .switch::after { top: 8px; left: 8px; width: 16px; height: 16px; background: var(--line-strong); box-shadow: none; }
html[data-uilib='material'] .switch[aria-checked='true'] { background: var(--primary); box-shadow: none; }
html[data-uilib='material'] .switch[aria-checked='true']::after { transform: translateX(20px) scale(1.5); background: var(--primary-ink); }
html[data-uilib='material'] .nav-item { border-radius: 28px; height: 40px; padding: 0 16px; }
html[data-uilib='material'] .nav-item.active { background: #e8def8; box-shadow: none; color: #1d192b; }
html[data-uilib='material'][data-theme='dark'] .nav-item.active { background: #4a4458; color: #e8def8; }
html[data-uilib='material'] .tabs button[aria-selected='true']::after { height: 3px; background: var(--primary); left: 0; right: 0; border-radius: 3px 3px 0 0; }
html[data-uilib='material'] .tabs button[aria-selected='true'] { color: var(--primary); }
html[data-uilib='material'] .badge { border: 0; border-radius: 8px; }
html[data-uilib='material'] .modal { border-radius: 28px; border: 0; background: var(--surface-3); }
`,
  },
  {
    id: 'antd',
    name: 'Ant Design',
    note: 'Ant blue primary, 6 px corners, compact 32 px controls, grey table headers.',
    tokens: {
      light: {
        color: t({ page: '#f5f5f5', surface: '#ffffff', 'surface-2': '#fafafa', 'surface-3': '#f0f0f0', sunken: '#f5f5f5', ink: 'rgba(0, 0, 0, 0.88)', 'ink-2': 'rgba(0, 0, 0, 0.65)', 'ink-3': 'rgba(0, 0, 0, 0.45)', line: '#f0f0f0', 'line-strong': '#d9d9d9', primary: '#1677ff', 'primary-ink': '#ffffff', accent: '#1677ff', 'accent-wash': 'rgba(5, 145, 255, 0.1)', focus: '#1677ff' }),
        radius: t({ 'r-sm': '6px', r: '8px', 'r-lg': '8px' }),
        font: t({ font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif" }),
        shadow: t({ 'shadow-sm': 'none', shadow: '0 1px 2px 0 rgba(0,0,0,.03), 0 1px 6px -1px rgba(0,0,0,.02), 0 2px 4px 0 rgba(0,0,0,.02)' }),
      },
      dark: {
        color: t({ page: '#000000', surface: '#141414', 'surface-2': '#1d1d1d', 'surface-3': '#262626', sunken: '#000000', ink: 'rgba(255, 255, 255, 0.85)', 'ink-2': 'rgba(255, 255, 255, 0.65)', 'ink-3': 'rgba(255, 255, 255, 0.45)', line: '#303030', 'line-strong': '#424242', primary: '#1668dc', 'primary-ink': '#ffffff', accent: '#1668dc' }),
      },
    },
    css: `
html[data-uilib='antd'] .btn { font-weight: 400; font-size: 14px; box-shadow: 0 2px 0 rgba(0,0,0,.02); }
html[data-uilib='antd'] .btn:hover { background: var(--surface); color: color-mix(in srgb, var(--primary) 80%, white); border-color: color-mix(in srgb, var(--primary) 80%, white); }
html[data-uilib='antd'] .btn.primary { box-shadow: 0 2px 0 rgba(5,145,255,.1); }
html[data-uilib='antd'] .btn.primary:hover { opacity: 1; background: color-mix(in srgb, var(--primary) 80%, white); color: #fff; }
html[data-uilib='antd'] .btn.ghost { box-shadow: none; }
html[data-uilib='antd'] .btn.ghost:hover { background: rgba(0,0,0,.04); color: var(--ink); border-color: transparent; }
html[data-uilib='antd'] .card { border-color: var(--line); box-shadow: none; }
html[data-uilib='antd'] .input, html[data-uilib='antd'] .select { height: 32px; }
html[data-uilib='antd'] .input:hover, html[data-uilib='antd'] .select:hover { border-color: color-mix(in srgb, var(--primary) 80%, white); }
html[data-uilib='antd'] .input:focus, html[data-uilib='antd'] .select:focus, html[data-uilib='antd'] .textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(5,145,255,.1); }
html[data-uilib='antd'] .chip { border-radius: 4px; height: 24px; padding: 0 7px; font-size: 12px; background: var(--surface-2); border-color: var(--line-strong); }
html[data-uilib='antd'] .chip[aria-pressed='true'] { background: var(--primary); color: #fff; }
html[data-uilib='antd'] .seg { background: rgba(0,0,0,.04); border: 0; padding: 2px; border-radius: 6px; }
html[data-uilib='antd'] .seg button { border-radius: 4px; font-weight: 400; }
html[data-uilib='antd'] .seg button[aria-pressed='true'] { box-shadow: 0 1px 2px 0 rgba(0,0,0,.03), 0 1px 6px -1px rgba(0,0,0,.02), 0 2px 4px 0 rgba(0,0,0,.02); }
html[data-uilib='antd'] .switch { width: 44px; height: 22px; background: rgba(0,0,0,.25); }
html[data-uilib='antd'] .switch::after { width: 18px; height: 18px; }
html[data-uilib='antd'] .switch[aria-checked='true'] { background: var(--primary); }
html[data-uilib='antd'] .switch[aria-checked='true']::after { transform: translateX(22px); background: #fff; }
html[data-uilib='antd'] .table th { background: var(--surface-2); color: var(--ink); font-weight: 600; font-size: 14px; }
html[data-uilib='antd'] .nav-item { border-radius: 8px; }
html[data-uilib='antd'] .nav-item.active { background: #e6f4ff; color: var(--primary); box-shadow: none; }
html[data-uilib='antd'][data-theme='dark'] .nav-item.active { background: #111a2c; color: #1668dc; }
html[data-uilib='antd'] .tabs button[aria-selected='true'] { color: var(--primary); }
html[data-uilib='antd'] .tabs button[aria-selected='true']::after { background: var(--primary); left: 0; right: 0; }
html[data-uilib='antd'] .badge { border-radius: 4px; font-weight: 400; }
`,
  },
  {
    id: 'shadcn',
    name: 'shadcn/ui',
    note: 'Zinc neutrals, 8 px corners, thin borders, solid black primary, ring focus.',
    tokens: {
      light: {
        color: t({ page: '#ffffff', surface: '#ffffff', 'surface-2': '#f4f4f5', 'surface-3': '#e4e4e7', sunken: '#fafafa', ink: '#09090b', 'ink-2': '#3f3f46', 'ink-3': '#71717a', line: '#e4e4e7', 'line-strong': '#e4e4e7', primary: '#18181b', 'primary-ink': '#fafafa', accent: '#18181b', 'accent-wash': 'rgba(24, 24, 27, 0.08)', focus: '#a1a1aa' }),
        radius: t({ 'r-sm': '6px', r: '8px', 'r-lg': '12px' }),
        font: t({ font: "'Inter Variable', ui-sans-serif, system-ui, sans-serif" }),
        shadow: t({ 'shadow-sm': '0 1px 2px 0 rgba(0,0,0,.05)', shadow: '0 1px 3px 0 rgba(0,0,0,.1), 0 1px 2px -1px rgba(0,0,0,.1)' }),
      },
      dark: {
        color: t({ page: '#09090b', surface: '#09090b', 'surface-2': '#27272a', 'surface-3': '#3f3f46', sunken: '#0c0c0e', ink: '#fafafa', 'ink-2': '#d4d4d8', 'ink-3': '#a1a1aa', line: '#27272a', 'line-strong': '#27272a', primary: '#fafafa', 'primary-ink': '#18181b', accent: '#fafafa' }),
      },
    },
    css: `
html[data-uilib='shadcn'] .btn { height: 36px; padding: 0 16px; font-weight: 500; font-size: 14px; border-color: var(--line); box-shadow: 0 1px 2px 0 rgba(0,0,0,.05); }
html[data-uilib='shadcn'] .btn.sm { height: 32px; padding: 0 12px; font-size: 13px; }
html[data-uilib='shadcn'] .btn.icon { width: 36px; padding: 0; } html[data-uilib='shadcn'] .btn.sm.icon { width: 32px; }
html[data-uilib='shadcn'] .btn.primary:hover { opacity: .9; }
html[data-uilib='shadcn'] .btn.ghost { box-shadow: none; }
html[data-uilib='shadcn'] .card { box-shadow: 0 1px 2px 0 rgba(0,0,0,.05); }
html[data-uilib='shadcn'] .input, html[data-uilib='shadcn'] .select { height: 36px; box-shadow: 0 1px 2px 0 rgba(0,0,0,.05); }
html[data-uilib='shadcn'] .input:focus, html[data-uilib='shadcn'] .select:focus, html[data-uilib='shadcn'] .textarea:focus { border-color: var(--line); box-shadow: 0 0 0 2px var(--surface), 0 0 0 4px #a1a1aa; }
html[data-uilib='shadcn'] .chip { border-radius: 6px; height: 28px; font-weight: 500; }
html[data-uilib='shadcn'] .seg { border-radius: 8px; background: var(--surface-2); border: 0; padding: 3px; }
html[data-uilib='shadcn'] .seg button { border-radius: 6px; height: 28px; }
html[data-uilib='shadcn'] .seg button[aria-pressed='true'] { box-shadow: 0 1px 3px 0 rgba(0,0,0,.1); }
html[data-uilib='shadcn'] .switch { width: 44px; height: 24px; }
html[data-uilib='shadcn'] .switch::after { width: 20px; height: 20px; }
html[data-uilib='shadcn'] .switch[aria-checked='true']::after { transform: translateX(20px); }
html[data-uilib='shadcn'] .tabs { border-bottom: 0; background: var(--surface-2); border-radius: 8px; padding: 3px; display: inline-flex; }
html[data-uilib='shadcn'] .tabs button { height: 30px; border-radius: 6px; }
html[data-uilib='shadcn'] .tabs button[aria-selected='true'] { background: var(--surface); box-shadow: 0 1px 3px 0 rgba(0,0,0,.1); }
html[data-uilib='shadcn'] .tabs button[aria-selected='true']::after { display: none; }
html[data-uilib='shadcn'] .nav-item.active { background: var(--surface-2); box-shadow: none; }
html[data-uilib='shadcn'] .badge { border-radius: 6px; font-weight: 600; }
`,
  },
  {
    id: 'bootstrap',
    name: 'Bootstrap 5',
    note: 'Bootstrap blue, 6 px corners, bordered cards, solid buttons, blue focus glow.',
    tokens: {
      light: {
        color: t({ page: '#ffffff', surface: '#ffffff', 'surface-2': '#f8f9fa', 'surface-3': '#e9ecef', sunken: '#f8f9fa', ink: '#212529', 'ink-2': '#495057', 'ink-3': '#6c757d', line: 'rgba(0, 0, 0, 0.175)', 'line-strong': '#dee2e6', primary: '#0d6efd', 'primary-ink': '#ffffff', accent: '#0d6efd', 'accent-wash': 'rgba(13, 110, 253, 0.25)', focus: '#86b7fe' }),
        radius: t({ 'r-sm': '6px', r: '6px', 'r-lg': '8px' }),
        font: t({ font: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif" }),
        shadow: t({ 'shadow-sm': 'none', shadow: '0 .125rem .25rem rgba(0,0,0,.075)' }),
      },
      dark: {
        color: t({ page: '#212529', surface: '#212529', 'surface-2': '#2b3035', 'surface-3': '#343a40', sunken: '#1a1d20', ink: '#dee2e6', 'ink-2': '#adb5bd', 'ink-3': '#8f969d', line: 'rgba(255, 255, 255, 0.15)', 'line-strong': '#495057', primary: '#0d6efd', 'primary-ink': '#ffffff', accent: '#6ea8fe' }),
      },
    },
    css: `
html[data-uilib='bootstrap'] .btn { height: 38px; padding: 0 12px; font-weight: 400; font-size: 15px; }
html[data-uilib='bootstrap'] .btn.sm { height: 31px; padding: 0 8px; font-size: 13px; border-radius: 4px; }
html[data-uilib='bootstrap'] .btn.icon { width: 38px; padding: 0; } html[data-uilib='bootstrap'] .btn.sm.icon { width: 31px; }
html[data-uilib='bootstrap'] .btn:hover { background: var(--surface-3); }
html[data-uilib='bootstrap'] .btn.primary:hover { opacity: 1; background: color-mix(in srgb, var(--primary) 85%, black); }
html[data-uilib='bootstrap'] .btn:focus-visible { box-shadow: 0 0 0 .25rem color-mix(in srgb, var(--primary) 25%, transparent); outline: 0; }
html[data-uilib='bootstrap'] .card { box-shadow: none; }
html[data-uilib='bootstrap'] .input, html[data-uilib='bootstrap'] .select { height: 38px; font-size: 15px; border-color: #dee2e6; }
html[data-uilib='bootstrap'] .input:focus, html[data-uilib='bootstrap'] .select:focus, html[data-uilib='bootstrap'] .textarea:focus { border-color: color-mix(in srgb, var(--primary) 50%, white); box-shadow: 0 0 0 .25rem color-mix(in srgb, var(--primary) 25%, transparent); }
html[data-uilib='bootstrap'] .chip { border-radius: 50rem; font-weight: 400; }
html[data-uilib='bootstrap'] .chip[aria-pressed='true'] { background: var(--primary); color: #fff; }
html[data-uilib='bootstrap'] .seg { padding: 0; border-radius: 6px; border-color: var(--primary); background: transparent; overflow: hidden; }
html[data-uilib='bootstrap'] .seg button { border-radius: 0; color: var(--primary); height: 31px; }
html[data-uilib='bootstrap'] .seg button[aria-pressed='true'] { background: var(--primary); color: #fff; box-shadow: none; }
html[data-uilib='bootstrap'] .switch { width: 32px; height: 16px; background: var(--surface); box-shadow: inset 0 0 0 1px #dee2e6; }
html[data-uilib='bootstrap'] .switch::after { top: 3px; left: 3px; width: 10px; height: 10px; background: #bfc4c9; box-shadow: none; }
html[data-uilib='bootstrap'] .switch[aria-checked='true'] { background: var(--primary); box-shadow: none; }
html[data-uilib='bootstrap'] .switch[aria-checked='true']::after { transform: translateX(16px); background: #fff; }
html[data-uilib='bootstrap'] .tabs button { border: 1px solid transparent; border-bottom: 0; border-radius: 6px 6px 0 0; margin-bottom: -1px; color: var(--primary); }
html[data-uilib='bootstrap'] .tabs button[aria-selected='true'] { border-color: #dee2e6; background: var(--surface); color: var(--ink-2); }
html[data-uilib='bootstrap'] .tabs button[aria-selected='true']::after { display: none; }
html[data-uilib='bootstrap'] .nav-item.active { background: var(--primary); color: #fff; box-shadow: none; }
html[data-uilib='bootstrap'] .nav-item.active .count { color: rgba(255,255,255,.8); }
html[data-uilib='bootstrap'] .badge { border: 0; border-radius: 6px; font-weight: 700; font-size: 11.5px; background: var(--surface-3); }
`,
  },
]

export const presetOf = (id: string) => PRESETS.find((p) => p.id === id) ?? PRESETS[0]

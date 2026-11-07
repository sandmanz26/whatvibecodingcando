/**
 * Sample looks: complete token sets with clearly different characters, so switching shows what
 * design tokens alone can change: colour, contrast, corners, shadows, type and placeholders.
 * Each is a plain token document over the app's own names; no component rules (those are the
 * UI-library looks in presets.ts).
 */
import type { DesignDoc } from './tokens'

export interface Look { id: string; name: string; note: string; swatch: [string, string, string]; doc: DesignDoc }

const t = (vars: Record<string, string>) => Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, { $value: v }]))

/** One palette for both modes: these looks have a single mood whatever the theme. */
const single = (vars: Record<string, string>): DesignDoc => ({ light: { look: t(vars) }, dark: { look: t(vars) } })

export const LOOKS: Look[] = [
  {
    id: 'neon', name: 'Midnight Neon', note: 'Dark, electric teal and magenta', swatch: ['#0b0b1a', '#00f0c8', '#ff3d9a'],
    doc: single({
      page: '#0b0b1a', surface: '#15152b', 'surface-2': '#1d1d3a', 'surface-3': '#26264a', sunken: '#101024',
      ink: '#ecebff', 'ink-2': '#b3b1e6', 'ink-3': '#8583c2', line: '#2c2b52', 'line-strong': '#4a4885',
      primary: '#00f0c8', 'primary-ink': '#03121a', accent: '#ff3d9a', 'accent-wash': 'rgba(255, 61, 154, 0.16)', focus: '#00f0c8',
      ph: '#1d1d3a', 'ph-line': '#3a3870',
      r: '12px', 'r-sm': '8px', 'r-lg': '18px', font: "'Inter Variable', system-ui, sans-serif",
      'shadow-sm': '0 0 0 1px rgba(0, 240, 200, 0.15)', shadow: '0 8px 30px rgba(0, 240, 200, 0.12)', 'shadow-lg': '0 20px 60px rgba(255, 61, 154, 0.25)',
    }),
  },
  {
    id: 'paper', name: 'Paper Press', note: 'Editorial cream, serif, sharp corners', swatch: ['#f4efe4', '#8b1e1e', '#1b1712'],
    doc: {
      light: { look: t({
        page: '#f4efe4', surface: '#fffaf0', 'surface-2': '#f1e9d8', 'surface-3': '#e6dcc6', sunken: '#ece4d3',
        ink: '#1b1712', 'ink-2': '#4f4538', 'ink-3': '#6f6352', line: '#d9cdb6', 'line-strong': '#a8987c',
        primary: '#8b1e1e', 'primary-ink': '#fffaf0', accent: '#8b1e1e', 'accent-wash': 'rgba(139, 30, 30, 0.09)', focus: '#8b1e1e',
        ph: '#ebe1cc', 'ph-line': '#cbbd9f',
        r: '0px', 'r-sm': '0px', 'r-lg': '2px', font: "Georgia, 'Times New Roman', serif",
        'shadow-sm': 'none', shadow: '0 1px 0 #d9cdb6', 'shadow-lg': '0 12px 30px rgba(27, 23, 18, 0.18)',
      }) },
      dark: { look: t({ page: '#1c1813', surface: '#26211a', 'surface-2': '#2f2920', ink: '#f1e9d8', 'ink-2': '#cdbfa6', 'ink-3': '#a79a82', line: '#3d3529', primary: '#e0a37a', 'primary-ink': '#1c1813', accent: '#e0a37a' }) },
    },
  },
  {
    id: 'candy', name: 'Candy Pop', note: 'Pastel pink, pill buttons, playful', swatch: ['#fff0f7', '#ff4fa3', '#7c4dff'],
    doc: {
      light: { look: t({
        page: '#fff0f7', surface: '#ffffff', 'surface-2': '#fff5fb', 'surface-3': '#ffe3f1', sunken: '#ffe9f4',
        ink: '#3b1d4a', 'ink-2': '#6b4a7a', 'ink-3': '#8a6b98', line: '#ffd1e8', 'line-strong': '#f5a3cc',
        primary: '#ff4fa3', 'primary-ink': '#ffffff', accent: '#7c4dff', 'accent-wash': 'rgba(124, 77, 255, 0.12)', focus: '#7c4dff',
        ph: '#ffe3f1', 'ph-line': '#ffb3d6',
        r: '20px', 'r-sm': '999px', 'r-lg': '28px', font: "'Trebuchet MS', 'Segoe UI', system-ui, sans-serif",
        'shadow-sm': '0 2px 0 #ffd1e8', shadow: '0 8px 24px rgba(255, 79, 163, 0.18)', 'shadow-lg': '0 20px 50px rgba(124, 77, 255, 0.22)',
      }) },
      dark: { look: t({ page: '#2a1430', surface: '#38193f', 'surface-2': '#43204b', ink: '#ffe3f1', 'ink-2': '#f0b8d8', 'ink-3': '#c98fb3', line: '#5a2d63', primary: '#ff6fb5', 'primary-ink': '#2a1430', accent: '#b49bff' }) },
    },
  },
  {
    id: 'terminal', name: 'Terminal', note: 'Green monospace on black, no corners', swatch: ['#050805', '#39ff14', '#9dff9d'],
    doc: single({
      page: '#050805', surface: '#0b120b', 'surface-2': '#0f1a0f', 'surface-3': '#152515', sunken: '#081008',
      ink: '#a8ffa8', 'ink-2': '#6fd96f', 'ink-3': '#4fa64f', line: '#1d3a1d', 'line-strong': '#2f6b2f',
      primary: '#39ff14', 'primary-ink': '#031003', accent: '#39ff14', 'accent-wash': 'rgba(57, 255, 20, 0.1)', focus: '#39ff14',
      ph: '#0f1a0f', 'ph-line': '#1d3a1d',
      r: '0px', 'r-sm': '0px', 'r-lg': '0px', font: "'JetBrains Mono Variable', 'Courier New', monospace",
      'shadow-sm': 'none', shadow: 'none', 'shadow-lg': '0 0 0 1px #2f6b2f',
    }),
  },
  {
    id: 'forest', name: 'Forest Calm', note: 'Natural greens with amber, soft corners', swatch: ['#eef3ec', '#2f6b3a', '#c27d2b'],
    doc: {
      light: { look: t({
        page: '#eef3ec', surface: '#fbfdf9', 'surface-2': '#e8f0e5', 'surface-3': '#dbe7d6', sunken: '#e3ece0',
        ink: '#1d2b1f', 'ink-2': '#435a46', 'ink-3': '#5f7562', line: '#cfdccb', 'line-strong': '#a3b89e',
        primary: '#2f6b3a', 'primary-ink': '#fbfdf9', accent: '#c27d2b', 'accent-wash': 'rgba(194, 125, 43, 0.13)', focus: '#2f6b3a',
        ph: '#dfe9db', 'ph-line': '#b9cbb3',
        r: '12px', 'r-sm': '10px', 'r-lg': '20px', font: "'Palatino Linotype', Palatino, 'Book Antiqua', serif",
        'shadow-sm': '0 1px 2px rgba(29, 43, 31, 0.08)', shadow: '0 6px 18px rgba(29, 43, 31, 0.1)', 'shadow-lg': '0 18px 40px rgba(29, 43, 31, 0.16)',
      }) },
      dark: { look: t({ page: '#121a13', surface: '#1a241b', 'surface-2': '#223024', ink: '#e3eee0', 'ink-2': '#b6c9b1', 'ink-3': '#8fa58a', line: '#2c3d2e', primary: '#7fc28b', 'primary-ink': '#121a13', accent: '#e0a24f' }) },
    },
  },
  {
    id: 'brutal', name: 'Brutal Mono', note: 'Black, white and yellow, hard shadows', swatch: ['#ffffff', '#ffe600', '#000000'],
    doc: single({
      page: '#ffffff', surface: '#ffffff', 'surface-2': '#f2f2f2', 'surface-3': '#e6e6e6', sunken: '#f2f2f2',
      ink: '#000000', 'ink-2': '#1a1a1a', 'ink-3': '#333333', line: '#000000', 'line-strong': '#000000',
      primary: '#ffe600', 'primary-ink': '#000000', accent: '#000000', 'accent-wash': 'rgba(255, 230, 0, 0.35)', focus: '#000000',
      ph: '#ffe600', 'ph-line': '#000000',
      r: '0px', 'r-sm': '0px', 'r-lg': '0px', font: "'Helvetica Neue', Arial, sans-serif",
      'shadow-sm': '2px 2px 0 #000000', shadow: '4px 4px 0 #000000', 'shadow-lg': '8px 8px 0 #000000',
    }),
  },
  {
    id: 'noir', name: 'Luxe Noir', note: 'Black and gold, serif, quiet', swatch: ['#0e0d0b', '#c9a227', '#f3ead8'],
    doc: single({
      page: '#0e0d0b', surface: '#1a1814', 'surface-2': '#221f1a', 'surface-3': '#2c2821', sunken: '#13120f',
      ink: '#f3ead8', 'ink-2': '#cbbfa5', 'ink-3': '#a3977f', line: '#3a3428', 'line-strong': '#5c523f',
      primary: '#c9a227', 'primary-ink': '#1a1407', accent: '#c9a227', 'accent-wash': 'rgba(201, 162, 39, 0.14)', focus: '#c9a227',
      ph: '#221f1a', 'ph-line': '#3a3428',
      r: '2px', 'r-sm': '2px', 'r-lg': '4px', font: "Didot, 'Bodoni 72', Georgia, serif",
      'shadow-sm': 'none', shadow: '0 10px 30px rgba(0, 0, 0, 0.5)', 'shadow-lg': '0 24px 60px rgba(0, 0, 0, 0.6)',
    }),
  },
]
export const lookOf = (id: string) => LOOKS.find((l) => l.id === id)

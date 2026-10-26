/**
 * UI-library looks as role-based token palettes. Map each role to the project's own CSS
 * variable, then add component rules (see reference/ui-presets.md) under html[data-uilib="<id>"].
 * These imitate each library's look; they don't load the library's code.
 */
import type { DesignDoc } from './design-tokens'

export type Role =
  | 'page' | 'surface' | 'surface2' | 'text' | 'textMuted' | 'border' | 'borderStrong'
  | 'primary' | 'onPrimary' | 'accent' | 'focus' | 'radiusControl' | 'radiusCard' | 'font' | 'shadow'

export interface UiPreset { id: string; name: string; note: string; light: Partial<Record<Role, string>>; dark: Partial<Record<Role, string>> }

export const UI_PRESETS: UiPreset[] = [
  { id: 'default', name: 'Project default', note: 'The project’s own design.', light: {}, dark: {} },
  {
    id: 'material', name: 'Material 3', note: 'Tonal purple, pill buttons, filled tonal cards, outlined 4 px fields.',
    light: { page: '#fef7ff', surface: '#fffbfe', surface2: '#f3edf7', text: '#1d1b20', textMuted: '#49454f', border: '#cac4d0', borderStrong: '#79747e', primary: '#6750a4', onPrimary: '#ffffff', accent: '#6750a4', focus: '#6750a4', radiusControl: '20px', radiusCard: '16px', font: 'Roboto, system-ui, sans-serif', shadow: '0 1px 2px rgba(0,0,0,.3), 0 1px 3px 1px rgba(0,0,0,.15)' },
    dark: { page: '#141218', surface: '#1d1b20', surface2: '#2b2930', text: '#e6e0e9', textMuted: '#cac4d0', border: '#49454f', borderStrong: '#938f99', primary: '#d0bcff', onPrimary: '#381e72', accent: '#d0bcff' },
  },
  {
    id: 'antd', name: 'Ant Design', note: 'Ant blue, 6 px corners, compact 32 px controls, grey table headers.',
    light: { page: '#f5f5f5', surface: '#ffffff', surface2: '#fafafa', text: 'rgba(0,0,0,.88)', textMuted: 'rgba(0,0,0,.65)', border: '#f0f0f0', borderStrong: '#d9d9d9', primary: '#1677ff', onPrimary: '#ffffff', accent: '#1677ff', focus: '#1677ff', radiusControl: '6px', radiusCard: '8px', font: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", shadow: '0 1px 2px rgba(0,0,0,.03), 0 1px 6px -1px rgba(0,0,0,.02), 0 2px 4px rgba(0,0,0,.02)' },
    dark: { page: '#000000', surface: '#141414', surface2: '#1d1d1d', text: 'rgba(255,255,255,.85)', textMuted: 'rgba(255,255,255,.65)', border: '#303030', borderStrong: '#424242', primary: '#1668dc', onPrimary: '#ffffff', accent: '#1668dc' },
  },
  {
    id: 'shadcn', name: 'shadcn/ui', note: 'Zinc neutrals, 8 px corners, thin borders, black primary, ring focus.',
    light: { page: '#ffffff', surface: '#ffffff', surface2: '#f4f4f5', text: '#09090b', textMuted: '#71717a', border: '#e4e4e7', borderStrong: '#e4e4e7', primary: '#18181b', onPrimary: '#fafafa', accent: '#18181b', focus: '#a1a1aa', radiusControl: '6px', radiusCard: '12px', font: "Inter, ui-sans-serif, system-ui, sans-serif", shadow: '0 1px 2px rgba(0,0,0,.05)' },
    dark: { page: '#09090b', surface: '#09090b', surface2: '#27272a', text: '#fafafa', textMuted: '#a1a1aa', border: '#27272a', borderStrong: '#27272a', primary: '#fafafa', onPrimary: '#18181b', accent: '#fafafa' },
  },
  {
    id: 'bootstrap', name: 'Bootstrap 5', note: 'Bootstrap blue, 6 px corners, bordered cards, blue focus glow.',
    light: { page: '#ffffff', surface: '#ffffff', surface2: '#f8f9fa', text: '#212529', textMuted: '#6c757d', border: 'rgba(0,0,0,.175)', borderStrong: '#dee2e6', primary: '#0d6efd', onPrimary: '#ffffff', accent: '#0d6efd', focus: '#86b7fe', radiusControl: '6px', radiusCard: '8px', font: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif", shadow: '0 .125rem .25rem rgba(0,0,0,.075)' },
    dark: { page: '#212529', surface: '#212529', surface2: '#2b3035', text: '#dee2e6', textMuted: '#adb5bd', border: 'rgba(255,255,255,.15)', borderStrong: '#495057', primary: '#0d6efd', onPrimary: '#ffffff', accent: '#6ea8fe' },
  },
]

/**
 * A preset as a design document, for a project whose roles live in these CSS variables.
 * Example: presetDoc('material', { primary: 'primary', surface: 'card', text: 'foreground', … })
 */
export function presetDoc(id: string, map: Partial<Record<Role, string>>): DesignDoc {
  const p = UI_PRESETS.find((x) => x.id === id)
  if (!p) return {}
  const scope = (vals: Partial<Record<Role, string>>) => {
    const tree: Record<string, { $value: string }> = {}
    for (const [role, v] of Object.entries(vals)) { const name = map[role as Role]; if (name && v) tree[name.replace(/^--/, '')] = { $value: v } }
    return { preset: tree }
  }
  return { light: scope(p.light), dark: scope(p.dark) }
}

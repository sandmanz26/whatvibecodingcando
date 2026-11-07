/**
 * Example token files, so the upload can be tried without one of your own. Each is a different
 * format and a clearly different look from the app's own and from the others.
 */
export const SAMPLES: { fileName: string; text: string }[] = [
  {
    fileName: 'aurora.tokens.json',
    text: JSON.stringify({
      $description: 'W3C design tokens: a violet and teal brand palette, aliases, pill buttons and a dark mode',
      palette: {
        $type: 'color',
        violet: { 50: { $value: '#f5f0ff' }, 100: { $value: '#e9ddff' }, 500: { $value: '#7c3aed' }, 600: { $value: '#6d28d9' }, 300: { $value: '#c4a5ff' } },
        teal: { 400: { $value: '#2dd4bf' }, 600: { $value: '#0d9488' } },
        night: { 0: { $value: '#ffffff' }, 50: { $value: '#faf8ff' }, 200: { $value: '#ddd6f3' }, 500: { $value: '#6b6390' }, 800: { $value: '#231c3d' }, 900: { $value: '#18122b' }, 950: { $value: '#0f0a1f' } },
      },
      light: {
        color: {
          $type: 'color',
          page: { $value: '{palette.violet.50}' },
          surface: { $value: '{palette.night.0}' },
          'surface-2': { $value: '{palette.night.50}' },
          ink: { $value: '{palette.night.950}' },
          'ink-2': { $value: '{palette.night.500}' },
          line: { $value: '{palette.night.200}' },
          primary: { $value: '{palette.violet.600}' },
          'primary-ink': { $value: '{palette.night.0}' },
          accent: { $value: '{palette.teal.600}' },
          ph: { $value: '{palette.violet.100}' },
        },
        radius: { $type: 'dimension', r: { $value: '16px' }, 'r-sm': { $value: '999px' }, 'r-lg': { $value: '24px' } },
        shadow: { 'shadow': { $value: '0 10px 30px rgba(109, 40, 217, 0.18)' } },
        font: { font: { $value: "'Inter Variable', system-ui, sans-serif" } },
      },
      dark: {
        color: {
          $type: 'color',
          page: { $value: '{palette.night.950}' },
          surface: { $value: '{palette.night.900}' },
          'surface-2': { $value: '{palette.night.800}' },
          ink: { $value: '{palette.violet.50}' },
          'ink-2': { $value: '{palette.violet.300}' },
          line: { $value: '{palette.night.800}' },
          primary: { $value: '{palette.teal.400}' },
          'primary-ink': { $value: '{palette.night.950}' },
          accent: { $value: '{palette.violet.300}' },
          ph: { $value: '{palette.night.800}' },
        },
      },
    }, null, 2),
  },
  {
    fileName: 'retro-arcade.css',
    text: `/* CSS custom properties: :root is light, a selector mentioning dark is dark mode */
:root {
  --brand: #1b998b;
  --page: #fdf6e3;
  --surface: #fffdf5;
  --surface-2: #f6ecd2;
  --ink: #26213a;
  --ink-2: #5b5470;
  --ink-3: #8a8299;
  --line: #26213a;
  --primary: var(--brand);
  --primary-ink: #fffdf5;
  --accent: #ff6b35;
  --ph: #ffd166;
  --ph-line: #26213a;
  --r: 6px;
  --r-sm: 6px;
  --r-lg: 10px;
  --shadow-sm: 2px 2px 0 #26213a;
  --shadow: 4px 4px 0 #ff6b35;
  --font: Rockwell, 'Roboto Slab', 'Courier New', serif;
}
[data-theme='dark'] {
  --page: #1a1726;
  --surface: #26213a;
  --surface-2: #2f2948;
  --ink: #fdf6e3;
  --ink-2: #d6cdb4;
  --line: #fdf6e3;
  --shadow: 4px 4px 0 #1b998b;
}`,
  },
]

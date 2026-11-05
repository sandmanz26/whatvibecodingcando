/** Example token files, so the upload can be tried without one of your own. */
export const SAMPLES: { fileName: string; text: string }[] = [
  {
    fileName: 'ocean.tokens.json',
    text: JSON.stringify({
      $description: 'W3C design tokens with a brand palette, aliases and a dark mode',
      palette: {
        $type: 'color',
        blue: { 50: { $value: '#eef6ff' }, 500: { $value: '#1d6fd8' }, 600: { $value: '#165bb3' }, 900: { $value: '#0b2a55' } },
        slate: { 0: { $value: '#ffffff' }, 50: { $value: '#f5f8fb' }, 100: { $value: '#e7edf3' }, 300: { $value: '#b9c6d3' }, 600: { $value: '#4d5d6e' }, 800: { $value: '#1f2b37' }, 950: { $value: '#0c131a' } },
      },
      light: {
        color: {
          $type: 'color',
          page: { $value: '{palette.slate.50}' },
          surface: { $value: '{palette.slate.0}' },
          ink: { $value: '{palette.slate.950}' },
          'ink-2': { $value: '{palette.slate.600}' },
          line: { $value: '{palette.slate.100}' },
          primary: { $value: '{palette.blue.500}' },
          'primary-ink': { $value: '{palette.slate.0}' },
          accent: { $value: '{palette.blue.600}' },
        },
        radius: { $type: 'dimension', r: { $value: '12px' }, 'r-sm': { $value: '999px' }, 'r-lg': { $value: '18px' } },
      },
      dark: {
        color: {
          $type: 'color',
          page: { $value: '{palette.slate.950}' },
          surface: { $value: '{palette.slate.800}' },
          ink: { $value: '{palette.slate.50}' },
          'ink-2': { $value: '{palette.slate.300}' },
          primary: { $value: '{palette.blue.500}' },
          'primary-ink': { $value: '{palette.slate.0}' },
        },
      },
    }, null, 2),
  },
  {
    fileName: 'sunset.css',
    text: `/* CSS custom properties: :root is light, a selector mentioning dark is dark mode */
:root {
  --brand: #e8590c;
  --page: #fff8f3;
  --surface: #ffffff;
  --ink: #2b1a10;
  --ink-2: #7a5a48;
  --ink-3: #b8a092;
  --line: #f1dccd;
  --primary: var(--brand);
  --primary-ink: #ffffff;
  --r: 4px;
  --r-sm: 4px;
  --r-lg: 6px;
  --font: Georgia, 'Times New Roman', serif;
}
[data-theme='dark'] {
  --page: #1d130d;
  --surface: #2a1c14;
  --ink: #fbe9dd;
  --ink-2: #d2b29f;
}`,
  },
]

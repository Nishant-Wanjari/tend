const tok = (n) => `rgb(var(--${n}) / <alpha-value>)`;
module.exports = {
  content: ['./src/**/*.{js,jsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: tok('bg'), surface: tok('surface'), surface2: tok('surface-2'), line: tok('line'),
        ink: tok('ink'), muted: tok('muted'), faint: tok('faint'), brand: tok('brand'), onbrand: tok('on-brand'),
        brandsoft: tok('brand-soft'), sage: tok('sage'),
        c1: tok('c1'), c2: tok('c2'), c3: tok('c3'), c4: tok('c4'), c5: tok('c5'), c6: tok('c6'), c7: tok('c7'), c8: tok('c8'),
        good: tok('good'), warn: tok('warn'), bad: tok('bad'),
      },
      fontFamily: { sans: 'var(--font-sans)', serif: 'var(--font-serif)', mono: 'var(--font-mono)' },
      borderRadius: { xl: '14px', '2xl': '18px', '3xl': '24px' },
    },
  },
  plugins: [],
};

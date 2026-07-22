/** @type {import('tailwindcss').Config} */
/**
 * Tailwind v4 primarily reads colors from `@theme` in `app/globals.css`.
 * This config mirrors the same semantic tokens for tooling / documentation.
 */
const colors = {
  "brand-primary": "#EE7828",
  expense: "#E07A3D",
  income: "#2A9D8F",
  danger: "#C9786E",
  "cream-bg": "#FAF6EC",
  "cream-card": "#FFFFFF",
  "cream-border": "#EFE5D3",
  ink: "#3A322B",
  "ink-body": "#4A3E31",
  "ink-muted": "#8C8273",
};

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./context/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors,
    },
  },
  plugins: [],
};

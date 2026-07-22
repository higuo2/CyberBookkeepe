/** @type {import('tailwindcss').Config} */
/**
 * Quiet Luxury / Parchment — mirrored from `app/globals.css` `@theme`.
 */
const colors = {
  "brand-primary": "#C86235",
  expense: "#B8785C",
  income: "#5B7A66",
  danger: "#A87870",
  "cream-bg": "#F6F4EE",
  "cream-bg-soft": "#FBF9F5",
  "cream-card": "#FFFFFF",
  "cream-border": "#EAE5D9",
  "cream-divide": "#F0ECE1",
  ink: "#2C2420",
  "ink-body": "#5A5046",
  "ink-muted": "#9C9285",
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
      boxShadow: {
        quiet: "0 4px 20px -4px rgba(60, 50, 40, 0.03)",
        "2xs": "0 1px rgb(0 0 0 / 0.05)",
      },
    },
  },
  plugins: [],
};

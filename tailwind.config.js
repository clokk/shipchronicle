/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/studio/frontend/**/*.{html,tsx,ts}",
  ],
  theme: {
    extend: {
      colors: {
        // Backgrounds
        bg: "#0d0b0a",
        panel: "#181614",
        "panel-alt": "#1e1b18",
        // Primary accent
        accent: {
          DEFAULT: "#e07b39",
          hover: "#c66a2d",
        },
        // Semantic
        "commit-closed": "#5fb88e",
        "commit-open": "#d4a030",
        "user-accent": "#3d84a8",
        parallel: "#9d7cd8",
        // Text
        text: "#e8e4df",
        muted: "#a39e97",
        subtle: "#6d6862",
        // Legacy aliases
        "chronicle-blue": "#3d84a8",
        "chronicle-green": "#5fb88e",
        "chronicle-amber": "#d4a030",
        "chronicle-purple": "#9d7cd8",
      },
      fontFamily: {
        sans: ['"Source Serif 4"', "Georgia", "serif"],
        mono: ['"Fira Code"', '"JetBrains Mono"', "monospace"],
      },
    },
  },
  plugins: [],
};

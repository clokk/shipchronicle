/**
 * Shared Tailwind CSS preset for CogCommit
 * Uses warm brown theme from CLI Studio
 */

/** @type {import('tailwindcss').Config} */
module.exports = {
  theme: {
    extend: {
      colors: {
        // Background colors (warm browns)
        bg: "#0d0b0a",
        "bg-primary": "#0d0b0a",
        "bg-secondary": "#181614",
        panel: "#181614",
        "panel-alt": "#1e1b18",
        "bg-tertiary": "#1e1b18",
        border: "#2a2520",

        // Primary Accent (burnt orange)
        accent: {
          DEFAULT: "#e07b39",
          hover: "#c66a2d",
        },

        // Text colors
        text: {
          primary: "#e8e4df",
          muted: "#a39e97",
          subtle: "#6d6862",
        },

        // Semantic colors
        "chronicle-blue": "#3d84a8",
        "chronicle-green": "#5fb88e",
        "chronicle-amber": "#d4a030",
        "chronicle-purple": "#9d7cd8",
        "chronicle-red": "#e05252",

        // Commit states
        "commit-closed": "#5fb88e",
        "commit-open": "#d4a030",
        "user-accent": "#3d84a8",
        parallel: "#9d7cd8",
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        mono: ["var(--font-mono)", "Fira Code", "JetBrains Mono", "monospace"],
      },
      animation: {
        "slide-in": "slideIn 0.2s ease-out",
        expand: "expand 0.2s ease-out",
      },
      keyframes: {
        slideIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        expand: {
          "0%": { opacity: "0", maxHeight: "0" },
          "100%": { opacity: "1", maxHeight: "500px" },
        },
      },
    },
  },
};

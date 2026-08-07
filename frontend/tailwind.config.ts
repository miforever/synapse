import type { Config } from "tailwindcss";

/*
 * Semantic names, not colours.
 *
 * Each maps to a channel triple in globals.css, so `bg-surface/70` still
 * composes an opacity and the whole interface changes theme by swapping the
 * variables rather than the class names.
 */
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "rgb(var(--canvas) / <alpha-value>)",
        surface: "rgb(var(--surface) / <alpha-value>)",
        line: "rgb(var(--line) / <alpha-value>)",
        strong: "rgb(var(--strong) / <alpha-value>)",
        muted: "rgb(var(--muted) / <alpha-value>)",
        faint: "rgb(var(--faint) / <alpha-value>)",
        elevated: "rgb(var(--elevated) / <alpha-value>)",
        raised: "rgb(var(--raised) / <alpha-value>)",
        cyan: { DEFAULT: "rgb(var(--accent) / <alpha-value>)" },
        violet: { DEFAULT: "rgb(var(--violet) / <alpha-value>)" },
        indigo: { DEFAULT: "#818CF8", deep: "#3730A3" },
      },
      fontFamily: {
        display: ["var(--font-display)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};

export default config;

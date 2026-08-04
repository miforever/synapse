import type { Config } from "tailwindcss";

// Mirrors lib/palette.ts — see there for why these hues.
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        canvas: "#0A0814",
        surface: "#141024",
        edge: "#231F3D",
        cyan: { DEFAULT: "#00F0FF" },
        violet: { DEFAULT: "#A855F7" },
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

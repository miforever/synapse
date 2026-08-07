/**
 * Presentation for node classes.
 *
 * The daemon stores class names only — how each is painted is purely a canvas
 * concern, so it lives here. Hues are spaced along the logo's violet→cyan axis
 * rather than picked freely, so a dense graph still reads as one palette.
 * Classes the daemon learns at runtime fall back to a neutral accent.
 */

export const CLASS_COLORS: Readonly<Record<string, string>> = {
  // Entities — the cyan end.
  person: "#00F0FF",
  organization: "#22D3EE",
  place: "#38BDF8",
  object: "#60A5FA",

  // Work — through indigo.
  project: "#818CF8",
  plan: "#6366F1",
  issue: "#F472B6",
  event: "#7C3AED",

  // Knowledge — the violet end.
  idea: "#A855F7",
  decision: "#C084FC",
  preference: "#E879F9",
  resource: "#2DD4BF",
  fact: "#94A3B8",
};

/**
 * The same hues, darkened for a pale background.
 *
 * These are signal colours chosen to glow against near-black, and a colour
 * that glows on black is a pastel on white — legible as decoration, useless as
 * a label. Each is the same hue taken down in lightness until it reads as ink.
 */
export const CLASS_COLORS_LIGHT: Readonly<Record<string, string>> = {
  person: "#0891B2",
  organization: "#0E7490",
  place: "#0369A1",
  object: "#1D4ED8",

  project: "#4F46E5",
  plan: "#4338CA",
  issue: "#BE185D",
  event: "#6D28D9",

  idea: "#7E22CE",
  decision: "#9333EA",
  preference: "#A21CAF",
  resource: "#0F766E",
  fact: "#475569",
};

export const FALLBACK_COLOR = "#64748B";
export const FALLBACK_COLOR_LIGHT = "#475569";

export type ColorTheme = "dark" | "light";

export function colorForClass(name: string, theme: ColorTheme = "dark"): string {
  return theme === "light"
    ? (CLASS_COLORS_LIGHT[name] ?? FALLBACK_COLOR_LIGHT)
    : (CLASS_COLORS[name] ?? FALLBACK_COLOR);
}

/** `follow_up` -> `Follow Up`, for badges and filter chips. */
export function labelForClass(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

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

export const FALLBACK_COLOR = "#64748B";

export function colorForClass(name: string): string {
  return CLASS_COLORS[name] ?? FALLBACK_COLOR;
}

/** `follow_up` -> `Follow Up`, for badges and filter chips. */
export function labelForClass(name: string): string {
  return name
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

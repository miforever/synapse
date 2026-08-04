/**
 * Presentation for node classes.
 *
 * The daemon stores class names only — how each is painted is purely a canvas
 * concern, so it lives here. Classes the backend has learned at runtime fall
 * back to a neutral accent rather than going unrendered.
 */

export const CLASS_COLORS: Readonly<Record<string, string>> = {
  person: "#00FF66",
  project: "#00F0FF",
  idea: "#FFB800",
  event: "#A855F7",
  fact: "#94A3B8",
  plan: "#38BDF8",
  issue: "#FB7185",
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

/**
 * The interface palette, taken from the violet/cyan logo lockup.
 *
 * Everything the canvas draws sits on the violet→cyan axis so the app reads as
 * one piece with its branding, with a single neutral slate for text and
 * anything deliberately unremarkable.
 */

export const PALETTE = {
  // Surfaces — from the logo plate and its border.
  canvas: "#0A0814",
  surface: "#141024",
  border: "#231F3D",

  // Signal colours — the mark's two rays.
  cyan: "#00F0FF",
  violet: "#A855F7",
  indigo: "#818CF8",
  indigoDeep: "#3730A3",

  // Text.
  bright: "#FAFAFA",
  muted: "#94A3B8",
  faint: "#64748B",
} as const;

/**
 * What the canvas draws on, per theme.
 *
 * The renderer paints into WebGL and a 2D context, neither of which knows
 * anything about CSS variables — so the two themes are declared here and the
 * canvas is told which one is in force.
 */
export const CANVAS_THEMES = {
  dark: {
    background: "#0A0814",
    label: "#CBD5E1",
    link: "rgba(186, 200, 220, 0.55)",
    linkDimmed: "rgba(186, 200, 220, 0.08)",
    ring: "rgba(255,255,255,0.35)",
  },
  light: {
    background: "#FAFAFC",
    // Darker than the interface's muted text: a label sits on top of a glowing
    // node, and mid-grey on pale violet is the first thing to become
    // unreadable.
    label: "#334155",
    link: "rgba(71, 85, 105, 0.45)",
    linkDimmed: "rgba(71, 85, 105, 0.08)",
    ring: "rgba(15,23,42,0.25)",
  },
} as const;

export type CanvasTheme = keyof typeof CANVAS_THEMES;

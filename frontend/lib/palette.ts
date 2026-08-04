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

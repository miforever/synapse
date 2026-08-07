/**
 * How big a memory is drawn, from how connected it is.
 *
 * Degree is a decent proxy for importance, and it comes from the graph's own
 * structure rather than from anyone tagging it. Sized against the range the
 * graph actually has: most stores are ones and twos with a few hubs, and an
 * absolute curve would spend its range on degrees nobody has.
 */

import type { GraphEdge } from "./types";
import { endpointId } from "./types";

/** Connections per memory, counted once for the whole graph. */
export function degreesOf(edges: readonly GraphEdge[]): Map<string, number> {
  const degrees = new Map<string, number>();
  for (const edge of edges) {
    for (const end of [endpointId(edge.source), endpointId(edge.target)]) {
      degrees.set(end, (degrees.get(end) ?? 0) + 1);
    }
  }
  return degrees;
}

export interface Weighting {
  /** Multiplier on the base size, from 1 at the quietest to `max` at the busiest. */
  (degree: number): number;
}

/**
 * Build the sizing for a particular graph.
 *
 * The curve is gentle rather than linear: raising the normalised position to a
 * power below one lifts the middle, so the difference between one connection
 * and three is visible instead of being flattened by a single hub at the top
 * of the range.
 */
export function weighBy(
  degrees: ReadonlyMap<string, number>,
  { max = 2.6, curve = 0.6 }: { max?: number; curve?: number } = {},
): Weighting {
  const counts = [...degrees.values()];
  const busiest = counts.length ? Math.max(...counts) : 0;
  // Unconnected memories exist and are the quietest thing on the canvas, so
  // the floor is zero rather than the smallest degree that happens to appear.
  const span = busiest;

  return (degree: number) => {
    if (span <= 0) return 1;
    const share = Math.min(1, Math.max(0, degree / span));
    return 1 + (max - 1) * Math.pow(share, curve);
  };
}

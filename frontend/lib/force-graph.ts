/**
 * Minimal typings for the force-graph handle.
 *
 * The renderer is loaded dynamically (it touches `window`), which erases its
 * generated types. Declaring just the imperative surface we use keeps the
 * call sites type-checked without resorting to `any`.
 */

import { PALETTE } from "./palette";
import type { GraphEdge, GraphNode } from "./types";

export interface GraphData {
  nodes: GraphNode[];
  links: GraphEdge[];
}

export interface Coords {
  x: number;
  y: number;
  z?: number;
}

export interface ForceGraphHandle {
  graphData: (data?: GraphData) => GraphData;
  d3ReheatSimulation: () => void;
  zoomToFit: (durationMs?: number, padding?: number) => void;
  /** 3D only. */
  cameraPosition?: (
    position: Coords,
    lookAt?: Coords,
    transitionMs?: number,
  ) => void;
  /** 2D only. */
  centerAt?: (x?: number, y?: number, durationMs?: number) => void;
  zoom?: (scale?: number, durationMs?: number) => void;
}

/** Positions the simulation writes onto each node as it settles. */
export type PositionedNode = GraphNode & Partial<Coords>;

export const CANVAS_BACKGROUND = PALETTE.canvas;

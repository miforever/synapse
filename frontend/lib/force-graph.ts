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

/**
 * Note there is no `graphData` here: react-force-graph exposes that as a prop,
 * not a ref method. Reading or writing the graph through the handle throws at
 * runtime, so live updates must flow through the `graphData` prop instead.
 */
export interface ForceGraphHandle {
  d3ReheatSimulation?: () => void;
  /** Doubles as a getter when called with a name only. */
  d3Force?: (name: string, force?: unknown) => unknown;
  zoomToFit?: (durationMs?: number, padding?: number) => void;
  getGraphBbox?: () => { x: [number, number]; y: [number, number]; z?: [number, number] } | null;
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

/**
 * Positions the simulation writes onto each node as it settles, plus the
 * `f*` pins that hold a node in place once it has been dragged.
 */
export type PositionedNode = GraphNode &
  Partial<Coords> & {
    fx?: number;
    fy?: number;
    fz?: number;
  };

export const CANVAS_BACKGROUND = PALETTE.canvas;

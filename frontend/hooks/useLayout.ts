"use client";

import { useCallback, useEffect, useRef } from "react";

import { clearLayout, fetchLayout, saveLayout } from "@/lib/api";
import type { PositionedNode } from "@/lib/force-graph";
import type { SavedPosition } from "@/lib/types";

/**
 * Remembers where the user put things.
 *
 * Only pinned memories are stored — the ones dragged somewhere deliberately.
 * Persisting every node would freeze positions nobody chose, and would leave
 * new memories arriving into a fully cold layout with nothing to push them
 * into place. Unpinned nodes are re-derived by the simulation each load, which
 * it does well.
 *
 * Positions are written onto the node objects the renderer is already holding,
 * rather than kept in React state. The simulation reads `fx/fy/fz` off those
 * objects every tick, so a restore takes effect on the next frame without
 * re-rendering the canvas — re-rendering it would restart the physics.
 */

// Slow enough that a burst of dragging is one save, short enough that a lost
// tab costs at most this much arranging.
const SAVE_INTERVAL_MS = 30_000;

function pinnedPositions(
  nodes: PositionedNode[],
  mode: string,
): Record<string, SavedPosition> {
  const positions: Record<string, SavedPosition> = {};
  // Node objects are shared between the two canvases, so a node arranged in 3D
  // still carries a depth while the 2D view is open. Storing it there would
  // save a coordinate the flat canvas never chose.
  const spatial = mode === "3d";

  for (const node of nodes) {
    // fx is what dragging sets; its presence is what "placed by hand" means.
    if (node.fx === undefined || node.fy === undefined) continue;
    positions[node.id] = {
      x: node.fx,
      y: node.fy,
      z: spatial ? (node.fz ?? null) : null,
    };
  }

  return positions;
}

interface Options {
  mode: string;
  nodes: PositionedNode[];
  /** False until the graph has actually loaded, so an empty snapshot never
   *  overwrites a stored arrangement with nothing. */
  ready: boolean;
}

export function useLayout({ mode, nodes, ready }: Options) {
  // Read by the save path, which must see the current nodes without being
  // re-created — re-creating it would reset the interval on every tick.
  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;

  const dirty = useRef(false);
  const markMoved = useCallback(() => {
    dirty.current = true;
  }, []);

  const flush = useCallback(() => {
    if (!dirty.current) return;
    dirty.current = false;
    void saveLayout(mode, pinnedPositions(nodesRef.current, mode)).catch(() => {
      // Daemon unreachable. The arrangement is still on screen, and the next
      // save will carry it — losing it silently is better than interrupting.
      dirty.current = true;
    });
  }, [mode]);

  // Restore. Runs per mode, since the two canvases are arranged separately.
  useEffect(() => {
    if (!ready) return;
    const controller = new AbortController();

    fetchLayout(mode, controller.signal)
      .then((layout) => {
        const byId = new Map(nodesRef.current.map((node) => [node.id, node]));

        for (const [id, position] of Object.entries(layout.positions)) {
          const node = byId.get(id);
          if (!node) continue;

          node.x = position.x;
          node.y = position.y;
          node.fx = position.x;
          node.fy = position.y;
          if (position.z != null) {
            node.z = position.z;
            node.fz = position.z;
          }
        }
      })
      .catch(() => {
        // No stored layout, or no daemon. The simulation lays out from
        // scratch, which is the behaviour without this feature at all.
      });

    return () => controller.abort();
  }, [mode, ready]);

  /*
   * Save on a timer and as the page goes away.
   *
   * Never per frame, and never per tick: the positions change constantly while
   * the graph breathes, and only the pinned ones are worth a write.
   * `visibilitychange` rather than `unload`, which is unreliable on mobile and
   * blocked by the back/forward cache.
   */
  useEffect(() => {
    if (!ready) return;

    const timer = setInterval(flush, SAVE_INTERVAL_MS);
    const onHide = () => {
      if (document.visibilityState === "hidden") flush();
    };

    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);

    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      // Switching modes or leaving the canvas: keep what was arranged.
      flush();
    };
  }, [flush, ready]);

  /** Release every pin and forget the stored arrangement for this mode. */
  const reset = useCallback(async () => {
    for (const node of nodesRef.current) {
      node.fx = undefined;
      node.fy = undefined;
      node.fz = undefined;
    }
    dirty.current = false;
    await clearLayout(mode).catch(() => undefined);
  }, [mode]);

  return { markMoved, reset };
}

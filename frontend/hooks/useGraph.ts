"use client";

import { useEffect, useState } from "react";

import { fetchGraph } from "@/lib/api";
import { applyDelta, loadCachedGraph, saveCachedGraph } from "@/lib/graph-cache";
import type { GraphSnapshot } from "@/lib/types";

interface GraphState {
  snapshot: GraphSnapshot | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the graph once, from the cache and a delta where possible.
 *
 * Re-downloading the whole store to redraw what the browser was just looking
 * at costs 1.6MB at two thousand memories and grows with it. With a cached
 * copy it asks only what changed since — 88 bytes when the answer is nothing.
 *
 * The cache is never trusted on its own: it is a starting point that the
 * daemon corrects. If the delta fails for any reason, this falls back to the
 * full read rather than showing a graph that might be stale.
 *
 * Live additions deliberately do not flow through this state: they are pushed
 * straight into the renderer, so a new memory never re-renders the canvas.
 */
export function useGraph(): GraphState {
  const [state, setState] = useState<GraphState>({
    snapshot: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      const cached = await loadCachedGraph();

      if (cached) {
        try {
          const delta = await fetchGraph(controller.signal, cached.as_of);
          const merged = delta.complete ? delta : applyDelta(cached, delta);
          const snapshot = { ...merged, as_of: delta.as_of };

          setState({ snapshot, loading: false, error: null });
          void saveCachedGraph({ ...snapshot, as_of: delta.as_of ?? "" });
          return;
        } catch {
          if (controller.signal.aborted) return;
          // Fall through to the full read below. A daemon that cannot answer
          // a delta — restarted onto a different database, say — must not
          // leave the canvas showing a cache nobody has confirmed.
        }
      }

      try {
        const snapshot = await fetchGraph(controller.signal);
        setState({ snapshot, loading: false, error: null });
        if (snapshot.as_of) {
          void saveCachedGraph({ ...snapshot, as_of: snapshot.as_of });
        }
      } catch (error: unknown) {
        if (controller.signal.aborted) return;
        setState({
          snapshot: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load graph",
        });
      }
    };

    void load();
    return () => controller.abort();
  }, []);

  return state;
}

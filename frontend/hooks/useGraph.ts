"use client";

import { useEffect, useState } from "react";

import { fetchGraph } from "@/lib/api";
import type { GraphSnapshot } from "@/lib/types";

interface GraphState {
  snapshot: GraphSnapshot | null;
  loading: boolean;
  error: string | null;
}

/**
 * Loads the initial graph once.
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

    fetchGraph(controller.signal)
      .then((snapshot) => setState({ snapshot, loading: false, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({
          snapshot: null,
          loading: false,
          error: error instanceof Error ? error.message : "Failed to load graph",
        });
      });

    return () => controller.abort();
  }, []);

  return state;
}

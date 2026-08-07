"use client";

import type { ReactNode } from "react";

import { AppBar } from "@/components/AppBar";
import { GraphProvider } from "@/components/GraphProvider";

/**
 * Everything that is a view of the graph.
 *
 * The bar and the graph itself live here rather than in the pages, so moving
 * between Canvas and Roadmap — or between 2D and 3D — changes only what is
 * being drawn. Next keeps a shared layout mounted across a segment change,
 * which is what lets the simulation keep the very node objects it has settled
 * instead of being handed a fresh set on every navigation.
 */
export default function ViewsLayout({ children }: { children: ReactNode }) {
  return (
    <GraphProvider>
      <AppBar />
      {children}
    </GraphProvider>
  );
}

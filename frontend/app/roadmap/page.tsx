"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { NodeDrawer } from "@/components/NodeDrawer";
import { RoadmapBoard } from "@/components/RoadmapBoard";
import { StatusOverlay } from "@/components/StatusOverlay";
import { useGraph } from "@/hooks/useGraph";
import { useGraphStream } from "@/hooks/useGraphStream";
import { useSettings } from "@/hooks/useSettings";
import { buildRoadmap } from "@/lib/roadmap";
import type { GraphEdge, GraphNode } from "@/lib/types";
import { endpointId } from "@/lib/types";

/**
 * The graph, seen as work.
 *
 * A separate route rather than a third canvas mode: 2D and 3D are two ways of
 * drawing the same thing, where this is a different question asked of it —
 * what is in flight, what is waiting on what, what is late. It reads the same
 * snapshot the canvas does, so arriving here costs nothing but a render.
 */
export default function RoadmapPage() {
  const { snapshot, loading, error } = useGraph();
  const { settings } = useSettings();

  const [data, setData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({
    nodes: [],
    edges: [],
  });
  const [selected, setSelected] = useState<GraphNode | null>(null);

  useMemo(() => {
    if (snapshot) setData({ nodes: snapshot.nodes, edges: snapshot.edges });
  }, [snapshot]);

  /*
   * Live updates matter more here than on the canvas.
   *
   * An agent marking a task done while you are looking at the board is the
   * whole point of the board being live — the change arrives as a node update
   * and the lane it sits in is recomputed from it.
   */
  const connected = useGraphStream(
    useMemo(
      () => ({
        onNewNode: (node: GraphNode, edges: GraphEdge[]) =>
          setData((current) =>
            current.nodes.some((existing) => existing.id === node.id)
              ? current
              : {
                  nodes: [...current.nodes, node],
                  edges: [...current.edges, ...edges],
                },
          ),
        onNodeUpdated: (node: GraphNode) =>
          setData((current) => ({
            ...current,
            nodes: current.nodes.map((existing) =>
              existing.id === node.id ? { ...existing, ...node } : existing,
            ),
          })),
        onNodeDeleted: (nodeId: string) =>
          setData((current) => ({
            nodes: current.nodes.filter((node) => node.id !== nodeId),
            edges: current.edges.filter(
              (edge) =>
                endpointId(edge.source) !== nodeId &&
                endpointId(edge.target) !== nodeId,
            ),
          })),
      }),
      [],
    ),
  );

  const roadmap = useMemo(
    () => buildRoadmap(data.nodes, data.edges),
    [data.nodes, data.edges],
  );

  const nodesById = useMemo(
    () => new Map(data.nodes.map((node) => [node.id, node])),
    [data.nodes],
  );

  return (
    <main className="min-h-screen bg-canvas">
      <header className="sticky top-0 z-20 flex items-center gap-4 border-b border-white/10 bg-canvas/80 px-6 py-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/branding/synapse-mark.svg"
            alt="SYNAPSE"
            width={24}
            height={24}
          />
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500 transition hover:text-slate-300">
            ← Canvas
          </span>
        </Link>

        <span className="h-5 w-px bg-white/10" />

        <h1 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-300">
          Roadmap
        </h1>

        <span className="flex items-center gap-2">
          <span
            className={`h-1.5 w-1.5 rounded-full ${
              connected ? "bg-emerald-400" : "bg-slate-600"
            }`}
            title={connected ? "Live" : "Reconnecting…"}
          />
          <span
            data-testid="roadmap-count"
            className="font-mono text-[10px] tabular-nums text-slate-500"
          >
            {roadmap.total}
          </span>
          <span className="font-mono text-[10px] text-slate-600">
            {roadmap.total === 1 ? "item" : "items"}
          </span>
        </span>
      </header>

      <RoadmapBoard roadmap={roadmap} onOpen={setSelected} />

      <NodeDrawer
        node={selected}
        edges={data.edges}
        nodesById={nodesById}
        media={settings.media}
        onClose={() => setSelected(null)}
        onNavigate={(nodeId) => setSelected(nodesById.get(nodeId) ?? null)}
      />

      <StatusOverlay
        loading={loading}
        error={error}
        // Not "no memories" — a graph full of notes and no work is a perfectly
        // ordinary state, and the board says so itself.
        empty={false}
        onRetry={() => window.location.reload()}
      />
    </main>
  );
}

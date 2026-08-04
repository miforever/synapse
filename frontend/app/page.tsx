"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ControlBar } from "@/components/ControlBar";
import { type CanvasMode, GraphCanvas } from "@/components/GraphCanvas";
import { HoverCard } from "@/components/HoverCard";
import { Logo } from "@/components/Logo";
import { NodeDrawer } from "@/components/NodeDrawer";
import { useElementSize } from "@/hooks/useElementSize";
import { useGraph } from "@/hooks/useGraph";
import { useGraphStream } from "@/hooks/useGraphStream";
import { useSettings } from "@/hooks/useSettings";
import type { ForceGraphHandle, GraphData } from "@/lib/force-graph";
import type { GraphEdge, GraphNode } from "@/lib/types";
import { endpointId } from "@/lib/types";

export default function Home() {
  const container = useRef<HTMLDivElement>(null);
  const { width, height } = useElementSize(container);

  const graphRef = useRef<ForceGraphHandle | null>(null);
  const { snapshot, loading, error } = useGraph();
  const { settings, updateMedia } = useSettings();

  const [mode, setMode] = useState<CanvasMode>("3d");
  const [hovered, setHovered] = useState<GraphNode | null>(null);
  const [selected, setSelected] = useState<GraphNode | null>(null);
  const [pointer, setPointer] = useState({ x: 0, y: 0 });
  const [nodeCount, setNodeCount] = useState(0);

  /**
   * The renderer owns this object and mutates it as the simulation runs. It is
   * built once from the snapshot and never replaced, so switching 2D/3D reuses
   * the same node objects and their settled positions carry across.
   */
  const data = useMemo<GraphData>(
    () => ({ nodes: snapshot?.nodes ?? [], links: snapshot?.edges ?? [] }),
    [snapshot],
  );

  useEffect(() => setNodeCount(data.nodes.length), [data]);

  // Live writes go straight into the renderer. Routing them through React
  // state would rebuild the dataset and restart the physics on every write.
  const handleNewNode = useCallback(
    ({ node, edges }: { node: GraphNode; edges: GraphEdge[] }) => {
      const graph = graphRef.current;
      if (!graph) return;

      const current = graph.graphData();
      if (current.nodes.some((existing) => existing.id === node.id)) return;

      graph.graphData({
        nodes: [...current.nodes, node],
        links: [...current.links, ...edges],
      });
      setNodeCount(current.nodes.length + 1);
    },
    [],
  );

  const connected = useGraphStream(handleNewNode);

  const focusNode = useCallback((node: GraphNode) => {
    const graph = graphRef.current;
    const positioned = node as GraphNode & { x?: number; y?: number; z?: number };

    if (graph?.cameraPosition && positioned.z !== undefined) {
      const distance = 120;
      const ratio =
        1 +
        distance /
          Math.hypot(positioned.x ?? 0, positioned.y ?? 0, positioned.z ?? 0);
      graph.cameraPosition(
        {
          x: (positioned.x ?? 0) * ratio,
          y: (positioned.y ?? 0) * ratio,
          z: (positioned.z ?? 0) * ratio,
        },
        { x: positioned.x ?? 0, y: positioned.y ?? 0, z: positioned.z ?? 0 },
        800,
      );
    } else if (graph?.centerAt) {
      graph.centerAt(positioned.x, positioned.y, 800);
      graph.zoom?.(3, 800);
    }
  }, []);

  const handleSelect = useCallback(
    (node: GraphNode) => {
      setSelected(node);
      setHovered(null);
      focusNode(node);
    },
    [focusNode],
  );

  const handleNavigate = useCallback(
    (nodeId: string) => {
      const target = graphRef.current
        ?.graphData()
        .nodes.find((node) => node.id === nodeId);
      if (target) handleSelect(target);
    },
    [handleSelect],
  );

  const connectionCount = useMemo(() => {
    if (!hovered) return 0;
    return data.links.filter(
      (link) =>
        endpointId(link.source) === hovered.id ||
        endpointId(link.target) === hovered.id,
    ).length;
  }, [hovered, data.links]);

  return (
    <main
      ref={container}
      className="relative h-screen w-screen overflow-hidden bg-canvas"
      onPointerMove={(event) =>
        setPointer({ x: event.clientX, y: event.clientY })
      }
    >
      {width > 0 && height > 0 && (
        <GraphCanvas
          graphRef={graphRef}
          data={data}
          mode={mode}
          width={width}
          height={height}
          dimmed={selected !== null}
          onHover={setHovered}
          onSelect={handleSelect}
        />
      )}

      <ControlBar
        mode={mode}
        onModeChange={setMode}
        connected={connected}
        nodeCount={nodeCount}
        media={settings.media}
        onMediaChange={updateMedia}
      />

      <HoverCard
        node={selected ? null : hovered}
        connections={connectionCount}
        x={pointer.x}
        y={pointer.y}
      />

      <NodeDrawer
        node={selected}
        edges={data.links}
        media={settings.media}
        onClose={() => setSelected(null)}
        onNavigate={handleNavigate}
      />

      {!loading && nodeCount === 0 && (
        <EmptyState error={error} />
      )}
    </main>
  );
}

function EmptyState({ error }: { error: string | null }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
      <div className="glass-panel max-w-sm rounded-xl p-8 text-center">
        <Logo size={44} />
        <p className="mt-6 text-sm text-slate-400">
          {error
            ? `Cannot reach the daemon — ${error}`
            : "No memories yet. Connect an agent and call add_memory to watch the graph build itself."}
        </p>
      </div>
    </div>
  );
}

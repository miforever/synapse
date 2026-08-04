"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ControlBar } from "@/components/ControlBar";
import { type CanvasMode, GraphCanvas } from "@/components/GraphCanvas";
import { HoverCard } from "@/components/HoverCard";
import { Logo } from "@/components/Logo";
import { NodeDrawer } from "@/components/NodeDrawer";
import { SearchPanel } from "@/components/SearchPanel";
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
  const [query, setQuery] = useState("");
  const [activeClasses, setActiveClasses] = useState<Set<string>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

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

  // Live mutations go straight into the renderer. Routing them through React
  // state would rebuild the dataset and restart the physics on every write.
  const streamHandlers = useMemo(
    () => ({
      onNewNode: (node: GraphNode, edges: GraphEdge[]) => {
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

      onNodeUpdated: (node: GraphNode) => {
        const graph = graphRef.current;
        if (!graph) return;

        const current = graph.graphData();
        const existing = current.nodes.find((item) => item.id === node.id);
        if (!existing) return;

        // Copy the new fields onto the node the simulation already holds, so
        // an edit redraws in place instead of moving the node.
        Object.assign(existing, node);
        graph.graphData(current);
        setSelected((open) => (open?.id === node.id ? { ...open, ...node } : open));
      },

      onNodeDeleted: (nodeId: string) => {
        const graph = graphRef.current;
        if (!graph) return;

        const current = graph.graphData();
        const nodes = current.nodes.filter((item) => item.id !== nodeId);
        if (nodes.length === current.nodes.length) return;

        graph.graphData({
          nodes,
          // Edges cascade server-side; drop them here by endpoint.
          links: current.links.filter(
            (link) =>
              endpointId(link.source) !== nodeId &&
              endpointId(link.target) !== nodeId,
          ),
        });
        setNodeCount(nodes.length);
        setSelected((open) => (open?.id === nodeId ? null : open));
        setHovered((open) => (open?.id === nodeId ? null : open));
      },
    }),
    [],
  );

  const connected = useGraphStream(streamHandlers);

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

  // Chip vocabularies come from the loaded graph rather than another request:
  // only classes actually in use are worth offering as filters.
  const { classes, tags } = useMemo(() => {
    const classSet = new Set<string>();
    const tagSet = new Set<string>();
    for (const node of data.nodes) {
      classSet.add(node.type);
      node.tags.forEach((tag) => tagSet.add(tag));
    }
    return {
      classes: [...classSet].sort(),
      tags: [...tagSet].sort(),
    };
  }, [data.nodes]);

  const filtering = activeClasses.size > 0 || activeTags.size > 0;

  const visibleIds = useMemo(() => {
    if (!filtering) return null;
    return new Set(
      data.nodes
        .filter(
          (node) =>
            (activeClasses.size === 0 || activeClasses.has(node.type)) &&
            (activeTags.size === 0 ||
              node.tags.some((tag) => activeTags.has(tag))),
        )
        .map((node) => node.id),
    );
  }, [filtering, data.nodes, activeClasses, activeTags]);

  const toggleIn = useCallback(
    (setter: typeof setActiveClasses) => (name: string) =>
      setter((current) => {
        const next = new Set(current);
        if (!next.delete(name)) next.add(name);
        return next;
      }),
    [],
  );

  // Thumbnail URLs come from agent-authored memories, so they sit behind the
  // same trust gate as media inside the content.
  const showThumbnails =
    settings.media.images && settings.media.remote_sources;

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
          showThumbnails={showThumbnails}
          visibleIds={visibleIds}
          onHover={setHovered}
          onSelect={handleSelect}
        />
      )}

      <SearchPanel
        query={query}
        onQueryChange={setQuery}
        classes={classes}
        tags={tags}
        activeClasses={activeClasses}
        activeTags={activeTags}
        onToggleClass={toggleIn(setActiveClasses)}
        onToggleTag={toggleIn(setActiveTags)}
        onSelectResult={handleNavigate}
        matchCount={visibleIds ? visibleIds.size : null}
      />

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

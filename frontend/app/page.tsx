"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ControlBar } from "@/components/ControlBar";
import { type CanvasMode, GraphCanvas } from "@/components/GraphCanvas";
import { HoverCard } from "@/components/HoverCard";
import { NodeDrawer } from "@/components/NodeDrawer";
import { SearchPanel } from "@/components/SearchPanel";
import { StatusOverlay } from "@/components/StatusOverlay";
import { useElementSize } from "@/hooks/useElementSize";
import { useGraph } from "@/hooks/useGraph";
import { useGraphStream } from "@/hooks/useGraphStream";
import { useLayout } from "@/hooks/useLayout";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { useSettings } from "@/hooks/useSettings";
import { suspendOrbit } from "@/lib/ambient-orbit";
import type {
  ForceGraphHandle,
  GraphData,
  PositionedNode,
} from "@/lib/force-graph";
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
  const [query, setQuery] = useState("");
  const [activeClasses, setActiveClasses] = useState<Set<string>>(new Set());
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());
  const [motionOn, setMotionOn] = useState(true);

  /**
   * The renderer owns this object and mutates it as the simulation runs. It is
   * built once from the snapshot and never replaced, so switching 2D/3D reuses
   * the same node objects and their settled positions carry across.
   */
  const [data, setData] = useState<GraphData>({ nodes: [], links: [] });

  useEffect(() => {
    if (!snapshot) return;
    setData({ nodes: snapshot.nodes, links: snapshot.edges });
  }, [snapshot]);

  const nodeCount = data.nodes.length;

  /*
   * Positions the user arranged by hand, restored onto the very node objects
   * the renderer holds. Gated on the snapshot having arrived, so an empty
   * graph can never save over a stored arrangement with nothing.
   */
  const { markMoved, reset: resetLayout } = useLayout({
    mode,
    nodes: data.nodes as PositionedNode[],
    ready: nodeCount > 0,
  });

  /**
   * Live mutations replace the wrapper object but reuse the existing node
   * objects, which is what react-force-graph diffs on: untouched nodes keep
   * their positions and velocities, and only genuinely new ones are seeded,
   * so a write never restarts the layout.
   */
  const streamHandlers = useMemo(
    () => ({
      onNewNode: (node: GraphNode, edges: GraphEdge[]) =>
        setData((current) =>
          current.nodes.some((existing) => existing.id === node.id)
            ? current
            : { nodes: [...current.nodes, node], links: [...current.links, ...edges] },
        ),

      onNodeUpdated: (node: GraphNode) =>
        setData((current) => {
          const existing = current.nodes.find((item) => item.id === node.id);
          if (!existing) return current;
          // Mutate in place so the simulation keeps the node where it is.
          Object.assign(existing, node);
          setSelected((open) =>
            open?.id === node.id ? { ...open, ...node } : open,
          );
          return { nodes: [...current.nodes], links: current.links };
        }),

      onNodeDeleted: (nodeId: string) =>
        setData((current) => {
          const nodes = current.nodes.filter((item) => item.id !== nodeId);
          if (nodes.length === current.nodes.length) return current;
          setSelected((open) => (open?.id === nodeId ? null : open));
          setHovered((open) => (open?.id === nodeId ? null : open));
          return {
            nodes,
            // Edges cascade server-side; drop them here by endpoint.
            links: current.links.filter(
              (link) =>
                endpointId(link.source) !== nodeId &&
                endpointId(link.target) !== nodeId,
            ),
          };
        }),
    }),
    [],
  );

  const connected = useGraphStream(streamHandlers);



  const focusNode = useCallback((node: GraphNode) => {
    const graph = graphRef.current;
    const positioned = node as GraphNode & { x?: number; y?: number; z?: number };

    if (graph?.cameraPosition && positioned.z !== undefined) {
      // The transition tweens the camera itself; the ambient rotation stands
      // down until it lands, then picks up orbiting the newly focused memory.
      suspendOrbit(1000);
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
      const target = data.nodes.find((node) => node.id === nodeId);
      if (target) handleSelect(target);
    },
    [handleSelect, data.nodes],
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

  // Direct connections of the open memory, so focus can keep its immediate
  // neighbourhood legible instead of dimming everything but one node.
  const neighbourIds = useMemo(() => {
    if (!selected) return new Set<string>();
    const ids = new Set<string>();
    for (const link of data.links) {
      const source = endpointId(link.source);
      const target = endpointId(link.target);
      if (source === selected.id) ids.add(target);
      else if (target === selected.id) ids.add(source);
    }
    return ids;
  }, [selected, data.links]);

  const nodesById = useMemo(
    () => new Map(data.nodes.map((node) => [node.id, node])),
    [data.nodes],
  );

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

  const reducedMotion = useReducedMotion();
  const motion = motionOn && !reducedMotion;

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
          focusId={selected?.id ?? null}
          neighbourIds={neighbourIds}
          showThumbnails={showThumbnails}
          visibleIds={visibleIds}
          motion={motion}
          onHover={setHovered}
          onSelect={handleSelect}
          onNodeMoved={markMoved}
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
        motion={motion}
        onMotionChange={setMotionOn}
        reducedMotion={reducedMotion}
        onResetLayout={resetLayout}
      />

      <HoverCard
        /*
         * Previewing neighbours is most useful precisely when a memory is
         * open — that is when you are deciding where to go next. Only the
         * open memory itself is skipped, since the drawer already shows it.
         */
        node={hovered && hovered.id !== selected?.id ? hovered : null}
        connections={connectionCount}
        x={pointer.x}
        y={pointer.y}
      />

      <NodeDrawer
        node={selected}
        edges={data.links}
        nodesById={nodesById}
        media={settings.media}
        onClose={() => setSelected(null)}
        onNavigate={handleNavigate}
      />

      <StatusOverlay
        loading={loading}
        error={error}
        empty={nodeCount === 0}
        onRetry={() => window.location.reload()}
      />

    </main>
  );
}

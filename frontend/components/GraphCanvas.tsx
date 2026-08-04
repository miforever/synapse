"use client";

import dynamic from "next/dynamic";
import { type ComponentType, memo, useCallback, useEffect, useMemo } from "react";
import type { Object3D } from "three";

import {
  CANVAS_BACKGROUND,
  type ForceGraphHandle,
  type GraphData,
  type PositionedNode,
} from "@/lib/force-graph";
import { colorForClass } from "@/lib/node-classes";
import type { GraphEdge, GraphNode } from "@/lib/types";
import { buildNodeObject, disposeSpriteCache } from "./node-sprite";

/**
 * The renderer's own generics model nodes as open records, which does not line
 * up with our concrete GraphNode. Narrowing the dynamic import to exactly the
 * props we pass keeps our call sites type-checked without `any`.
 */
interface ForceGraphProps {
  ref?: React.Ref<ForceGraphHandle | null>;
  graphData: GraphData;
  width: number;
  height: number;
  backgroundColor: string;
  nodeId?: string;
  nodeLabel?: string;
  cooldownTicks?: number;
  linkColor?: () => string;
  linkWidth?: (link: GraphEdge) => number;
  linkDirectionalParticles?: (link: GraphEdge) => number;
  linkDirectionalParticleWidth?: number;
  linkDirectionalParticleSpeed?: number;
  onNodeHover?: (node: GraphNode | null) => void;
  onNodeClick?: (node: GraphNode) => void;
  // 3D only
  nodeThreeObject?: (node: GraphNode) => Object3D;
  nodeOpacity?: number;
  linkOpacity?: number;
  showNavInfo?: boolean;
  // 2D only
  nodeColor?: (node: GraphNode) => string;
  nodeCanvasObject?: (
    node: PositionedNode,
    ctx: CanvasRenderingContext2D,
    globalScale: number,
  ) => void;
  nodeCanvasObjectMode?: () => string;
}

// Both renderers touch `window`, so they can only load in the browser.
const ForceGraph2D = dynamic(() => import("react-force-graph-2d"), {
  ssr: false,
}) as unknown as ComponentType<ForceGraphProps>;

const ForceGraph3D = dynamic(() => import("react-force-graph-3d"), {
  ssr: false,
}) as unknown as ComponentType<ForceGraphProps>;

export type CanvasMode = "2d" | "3d";

interface Props {
  data: GraphData;
  mode: CanvasMode;
  width: number;
  height: number;
  dimmed: boolean;
  onHover: (node: GraphNode | null) => void;
  onSelect: (node: GraphNode) => void;
  graphRef: React.RefObject<ForceGraphHandle | null>;
}

const LINK_COLOR = "rgba(148, 163, 184, 0.28)";

/**
 * The force-graph renderer.
 *
 * Memoized, and every prop it receives is referentially stable, so hovering a
 * node or opening the drawer re-renders the overlays without touching the
 * simulation. Re-rendering here would restart the physics and visibly stutter.
 */
function GraphCanvasImpl({
  data,
  mode,
  width,
  height,
  dimmed,
  onHover,
  onSelect,
  graphRef,
}: Props) {
  const nodeColor = useCallback(
    (node: GraphNode) => colorForClass(node.type),
    [],
  );

  const linkWidth = useCallback(
    (link: GraphEdge) => 0.5 + link.weight * 1.5,
    [],
  );

  // Weight drives flow density, so strong relationships read as busier.
  const linkParticles = useCallback(
    (link: GraphEdge) => Math.round(1 + link.weight * 3),
    [],
  );

  const nodeThreeObject = useCallback(
    (node: GraphNode): Object3D => buildNodeObject(node),
    [],
  );

  // 2D nodes are drawn by hand: a filled dot, a ring, and a label that fades
  // in as you zoom, so a dense graph never becomes a wall of text.
  const paintNode2D = useCallback(
    (
      node: PositionedNode,
      ctx: CanvasRenderingContext2D,
      globalScale: number,
    ) => {
      const { x = 0, y = 0 } = node;
      const radius = 5;

      ctx.globalAlpha = dimmed ? 0.25 : 1;
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, 2 * Math.PI);
      ctx.fillStyle = colorForClass(node.type);
      ctx.fill();

      ctx.lineWidth = 1 / globalScale;
      ctx.strokeStyle = "rgba(255,255,255,0.35)";
      ctx.stroke();

      if (globalScale > 1.2) {
        ctx.globalAlpha = dimmed ? 0.2 : Math.min(1, (globalScale - 1.2) * 2);
        ctx.font = `${11 / globalScale}px var(--font-mono), monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#E2E8F0";
        ctx.fillText(node.title, x, y + radius + 2 / globalScale);
      }

      ctx.globalAlpha = 1;
    },
    [dimmed],
  );

  useEffect(() => disposeSpriteCache, []);

  const shared = useMemo<ForceGraphProps>(
    () => ({
      graphData: data,
      width,
      height,
      backgroundColor: CANVAS_BACKGROUND,
      nodeId: "id",
      nodeLabel: "",
      cooldownTicks: 120,
      linkColor: () => LINK_COLOR,
      linkWidth,
      linkDirectionalParticles: linkParticles,
      linkDirectionalParticleWidth: 1.6,
      linkDirectionalParticleSpeed: 0.006,
      onNodeHover: onHover,
      onNodeClick: onSelect,
    }),
    [data, width, height, linkWidth, linkParticles, onHover, onSelect],
  );

  if (mode === "3d") {
    return (
      <ForceGraph3D
        ref={graphRef}
        {...shared}
        nodeThreeObject={nodeThreeObject}
        nodeOpacity={dimmed ? 0.25 : 0.95}
        linkOpacity={dimmed ? 0.1 : 0.3}
        showNavInfo={false}
      />
    );
  }

  return (
    <ForceGraph2D
      ref={graphRef}
      {...shared}
      nodeColor={nodeColor}
      nodeCanvasObject={paintNode2D}
      nodeCanvasObjectMode={() => "replace"}
    />
  );
}

export const GraphCanvas = memo(GraphCanvasImpl);

"use client";

import dynamic from "next/dynamic";
import {
  type ComponentType,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { Object3D } from "three";

import {
  CANVAS_BACKGROUND,
  type Coords,
  type ForceGraphHandle,
  type GraphData,
  type PositionedNode,
} from "@/lib/force-graph";
import {
  advanceOrbit,
  holdOrbit,
  suspendOrbit,
} from "@/lib/ambient-orbit";
import { isLinkLit } from "@/lib/link-focus";
import { colorForClass } from "@/lib/node-classes";
import { endpointId, type GraphEdge, type GraphNode } from "@/lib/types";
import { getCircularThumbnail } from "@/lib/image-cache";
import { createDriftForce, setDriftPaused } from "@/lib/drift-force";
import {
  advancePlasma,
  buildLinkObject,
  disposePlasma,
  setLinkFocus,
  updateLinkObject,
} from "@/lib/link-plasma";
import { createLivingLinksForce } from "@/lib/living-links";
import { applyFocus, buildNodeObject, disposeSpriteCache } from "./node-sprite";

/**
 * The renderer's own generics model nodes as open records, which does not line
 * up with our concrete GraphNode. Narrowing the dynamic import to exactly the
 * props we pass keeps our call sites type-checked without `any`.
 */
interface ForceGraphProps {
  graphData: GraphData;
  width: number;
  height: number;
  backgroundColor: string;
  nodeId?: string;
  nodeLabel?: string;
  cooldownTicks?: number;
  cooldownTime?: number;
  linkColor?: (link: GraphEdge) => string;
  linkWidth?: number | ((link: GraphEdge) => number);
  linkDirectionalParticles?: number | ((link: GraphEdge) => number);
  linkDirectionalParticleWidth?: number;
  linkDirectionalParticleResolution?: number;
  linkDirectionalParticleSpeed?: number;
  onNodeHover?: (node: GraphNode | null) => void;
  onNodeClick?: (node: GraphNode) => void;
  nodeVisibility?: (node: GraphNode) => boolean;
  linkVisibility?: (link: GraphEdge) => boolean;
  enableNodeDrag?: boolean;
  onNodeDragEnd?: (node: PositionedNode) => void;
  d3VelocityDecay?: number;
  d3AlphaDecay?: number;
  d3AlphaMin?: number;
  warmupTicks?: number;
  // 3D only
  nodeThreeObject?: (node: GraphNode) => Object3D;
  linkThreeObject?: (link: GraphEdge) => Object3D;
  linkPositionUpdate?: (
    object: Object3D,
    coords: { start: Coords; end: Coords },
    link: GraphEdge,
  ) => boolean;
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

/**
 * Both renderers touch `window`, so they can only load in the browser.
 *
 * The imperative handle is passed as `innerRef` rather than `ref` on purpose:
 * next/dynamic hands back a ref to its own wrapper, which has none of the
 * graph methods on it. That failure is silent — `graphRef.current` is truthy,
 * so every call through it throws only when used — and it takes live node
 * injection, camera focus and the drift force down with it.
 */
type Loadable = ComponentType<
  ForceGraphProps & { innerRef?: React.Ref<ForceGraphHandle | null> }
>;

function passRef(load: () => Promise<{ default: ComponentType<never> }>) {
  return dynamic(
    async () => {
      const { default: Inner } = await load();
      const Wrapped = ({
        innerRef,
        ...props
      }: ForceGraphProps & { innerRef?: React.Ref<ForceGraphHandle | null> }) => {
        const Component = Inner as unknown as ComponentType<
          ForceGraphProps & { ref?: React.Ref<ForceGraphHandle | null> }
        >;
        return <Component ref={innerRef} {...props} />;
      };
      Wrapped.displayName = "ForceGraphWrapper";
      return Wrapped;
    },
    { ssr: false },
  ) as unknown as Loadable;
}

const ForceGraph2D = passRef(
  () => import("react-force-graph-2d") as never,
);

const ForceGraph3D = passRef(
  () => import("react-force-graph-3d") as never,
);

export type CanvasMode = "2d" | "3d";

interface Props {
  data: GraphData;
  mode: CanvasMode;
  width: number;
  height: number;
  /** The open memory, highlighted while everything else recedes. */
  focusId: string | null;
  /** Its direct connections, kept legible as context. */
  neighbourIds: ReadonlySet<string>;
  showThumbnails: boolean;
  /** null means no filter is active; otherwise only these ids render. */
  visibleIds: Set<string> | null;
  /** Ambient drift; off honours prefers-reduced-motion. */
  motion: boolean;
  onHover: (node: GraphNode | null) => void;
  onSelect: (node: GraphNode) => void;
  /** A memory was dragged somewhere, so the arrangement is worth saving. */
  onNodeMoved: () => void;
  graphRef: React.RefObject<ForceGraphHandle | null>;
}

const LABEL_MAX_CHARS = 24;
const MAX_LABEL_PX = 12;

/**
 * Canvas cannot resolve CSS custom properties, so `var(--font-mono)` makes the
 * whole font declaration invalid and the context silently keeps its previous
 * value — the default 10px sans-serif, interpreted in world units, which
 * renders labels several times their intended size. Family names must be
 * literal here.
 */
const LABEL_FONT = '"JetBrains Mono", ui-monospace, monospace';

function truncateLabel(title: string): string {
  return title.length > LABEL_MAX_CHARS
    ? `${title.slice(0, LABEL_MAX_CHARS - 1)}…`
    : title;
}

// Lines carry the structure, so they need to read clearly against the dark
// canvas rather than disappearing into it.
const LINK_COLOR = "rgba(186, 200, 220, 0.55)";

// Enough to keep the shape of the graph legible behind the open memory
// without competing with it. Matches the 3D shader's dimming.
const LINK_COLOR_DIMMED = "rgba(186, 200, 220, 0.08)";

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
  focusId,
  neighbourIds,
  showThumbnails,
  visibleIds,
  motion,
  onHover,
  onSelect,
  onNodeMoved,
  graphRef,
}: Props) {
  /**
   * The renderer loads asynchronously through next/dynamic, so the imperative
   * handle does not exist during the first effects. Tracking its arrival in
   * state is what makes force registration and camera work run at all —
   * reading the ref directly silently no-ops and never retries.
   */
  const [handle, setHandle] = useState<ForceGraphHandle | null>(null);
  const attach = useCallback(
    (instance: ForceGraphHandle | null) => {
      graphRef.current = instance;
      setHandle(instance);
    },
    [graphRef],
  );

  const nodeColor = useCallback(
    (node: GraphNode) => colorForClass(node.type),
    [],
  );

  const linkWidth = useCallback(
    (link: GraphEdge) => 0.5 + link.weight * 1.5,
    [],
  );

  /*
   * Recede the edges that are not part of the open memory's neighbourhood.
   *
   * This drives the 2D canvas, where it dims the travelling particles too —
   * they take their colour from the link unless told otherwise. The 3D view
   * cannot use it: its links are drawn by the plasma shader, which ignores
   * the renderer's own link styling entirely.
   */
  const linkColor = useCallback(
    (link: GraphEdge) =>
      isLinkLit(link, focusId, neighbourIds) ? LINK_COLOR : LINK_COLOR_DIMMED,
    [focusId, neighbourIds],
  );

  // Weight drives flow density, so strong relationships read as busier.
  const linkParticles = useCallback(
    (link: GraphEdge) => Math.round(1 + link.weight * 3),
    [],
  );

  const nodeThreeObject = useCallback(
    (node: GraphNode): Object3D => buildNodeObject(node, showThumbnails),
    [showThumbnails],
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
      const focusing = focusId !== null;
      const isFocus = node.id === focusId;
      const highlighted = isFocus || neighbourIds.has(node.id);
      const radius = isFocus ? 9 : highlighted && focusing ? 7 : 5;
      const color = colorForClass(node.type);

      ctx.globalAlpha = !focusing ? 1 : isFocus ? 1 : highlighted ? 0.85 : 0.12;

      const thumbnail =
        showThumbnails && node.thumbnail_url
          ? getCircularThumbnail(node.thumbnail_url, color, 128)
          : null;

      if (thumbnail) {
        // Already circular with its ring baked in — just place it.
        ctx.drawImage(
          thumbnail,
          x - radius,
          y - radius,
          radius * 2,
          radius * 2,
        );
      } else {
        ctx.beginPath();
        ctx.arc(x, y, radius, 0, 2 * Math.PI);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.lineWidth = (isFocus ? 2 : 1) / globalScale;
        ctx.strokeStyle = isFocus ? color : "rgba(255,255,255,0.35)";
        ctx.stroke();

        // A halo so the focused memory reads as lit rather than merely bigger.
        if (isFocus) {
          ctx.beginPath();
          ctx.arc(x, y, radius + 5, 0, 2 * Math.PI);
          ctx.strokeStyle = color;
          ctx.globalAlpha = 0.35;
          ctx.lineWidth = 2 / globalScale;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // Labels are sized in world units, proportional to the node, so text
      // and node keep their relationship at every zoom level. Sizing by
      // 1/globalScale instead pins text to a fixed pixel height, which makes
      // it tower over the nodes as soon as the view zooms in.
      const labelled = focusing ? highlighted : globalScale > 1.2;
      if (labelled) {
        ctx.globalAlpha = focusing && !highlighted ? 0 : 1;
        // Proportional to the node, but capped in screen pixels: a small
        // graph zooms in hard, and a purely proportional label then renders
        // several times the size of the node it names.
        const fontWorld = Math.min(radius * 1.25, MAX_LABEL_PX / globalScale);
        ctx.font = `${fontWorld}px ${LABEL_FONT}`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = "#CBD5E1";
        ctx.fillText(truncateLabel(node.title), x, y + radius + fontWorld * 0.6);
      }

      ctx.globalAlpha = 1;
    },
    [focusId, neighbourIds, showThumbnails],
  );

  // Filtering hides rather than removes: the simulation keeps running over
  // the full graph, so positions hold and clearing a filter is instant.
  const nodeVisibility = useCallback(
    (node: GraphNode) => !visibleIds || visibleIds.has(node.id),
    [visibleIds],
  );

  const linkVisibility = useCallback(
    (link: GraphEdge) =>
      !visibleIds ||
      (visibleIds.has(endpointId(link.source)) &&
        visibleIds.has(endpointId(link.target))),
    [visibleIds],
  );

  // Dragging a node pins it. Arranging the graph by hand is only useful if
  // the layout you make survives the next tick — and, once saved, the next
  // visit.
  const handleDragEnd = useCallback(
    (node: PositionedNode) => {
      node.fx = node.x;
      node.fy = node.y;
      node.fz = node.z;
      onNodeMoved();
    },
    [onNodeMoved],
  );

  /**
   * Spread the layout to suit its size.
   *
   * The renderer's defaults are tuned for tens of nodes; at a thousand the
   * repulsion is far too weak and the graph collapses into a dense ball that
   * reads as a single blob. Repulsion and link length both scale with node
   * count so a large graph opens up instead of clumping.
   */
  useEffect(() => {
    const graph = handle;
    if (!graph?.d3Force) return;

    const n = Math.max(data.nodes.length, 1);
    const charge = graph.d3Force("charge") as
      | { strength: (value: number) => void; distanceMax: (value: number) => void }
      | undefined;
    charge?.strength(-60 - Math.min(400, 14 * Math.sqrt(n)));
    /*
     * Keep repulsion local.
     *
     * At 700 a node pushed on everything within 700 units — most of the graph
     * — so dragging one memory visibly rearranged unrelated clusters. Limiting
     * the range means a drag disturbs its own neighbourhood and nothing else,
     * and it also keeps the many-body pass affordable at scale.
     */
    charge?.distanceMax(260);

    const link = graph.d3Force("link") as
      | { distance: (value: number) => void }
      | undefined;
    link?.distance(40 + Math.min(90, 2 * Math.sqrt(n)));

    /*
     * Drop the default centering force.
     *
     * d3.forceCenter re-centres the graph's centroid every tick by translating
     * every node. Drag one memory to the right and the centroid follows, so
     * all the others get shifted left to compensate — untouched nodes visibly
     * sliding the opposite way. The camera fit already tracks the centroid, so
     * nothing needs the graph pinned to the origin.
     */
    const center = graph.d3Force("center") as
      | { strength?: (value: number) => void }
      | undefined;
    // Removing by passing null is unreliable — the wrapper can read a falsy
    // second argument as a getter — so the force is neutralised instead.
    center?.strength?.(0);

    /*
     * No origin-referencing force here, deliberately.
     *
     * Charge and link are scaled by d3's alpha and fade as the layout cools,
     * but a custom force does not — so anything pulling toward the origin
     * ends up unopposed and implodes the entire graph to a point. Two
     * attempts at this (a centering force, then a radius-guarded boundary)
     * both collapsed it, measured at a 2-unit span.
     *
     * The cost is that memories with no edges drift to the periphery, since
     * nothing pulls them back. That is rare in practice — add_memory links
     * what it writes — and far preferable to a layout that can implode.
     *
     * Deliberately no reheat: it slams alpha back to full, and the layout
     * forces surging at full strength is exactly the sudden fast movement
     * that reads as a glitch. New nodes arrive warm enough on their own.
     */
  }, [data.nodes.length, handle, mode]);

  /**
   * Frame the graph after it has had time to lay out.
   *
   * This cannot hang off onEngineStop: the engine is deliberately never
   * allowed to stop so the drift keeps ticking, so that callback never fires.
   * Without an explicit fit the camera starts inside the cloud and a large
   * graph looks like a handful of stray dots.
   */
  useEffect(() => {
    if (data.nodes.length === 0) return;

    /*
     * Frame from the node positions rather than zoomToFit.
     *
     * getGraphBbox reports a far larger extent than the nodes actually
     * occupy — measured at +/-600 while every node sat within 222 units of
     * centre — so zoomToFit pulls the camera roughly 3x too far and the graph
     * shrinks to a dot. Measuring the real distribution avoids trusting it.
     */
    const fit = () => {
      const graph = graphRef.current;
      const nodes = data.nodes as PositionedNode[];
      if (!graph || nodes.length === 0) return;

      let cx = 0;
      let cy = 0;
      let cz = 0;
      let counted = 0;
      for (const node of nodes) {
        if (node.x === undefined || node.y === undefined) continue;
        cx += node.x;
        cy += node.y;
        cz += node.z ?? 0;
        counted += 1;
      }
      if (counted === 0) return;
      cx /= counted;
      cy /= counted;
      cz /= counted;

      const radii = nodes
        .filter((node) => node.x !== undefined && node.y !== undefined)
        .map((node) =>
          Math.hypot(
            (node.x ?? 0) - cx,
            (node.y ?? 0) - cy,
            (node.z ?? 0) - cz,
          ),
        )
        .sort((a, b) => a - b);

      // 95th percentile, so a couple of stray unlinked memories cannot drag
      // the whole framing out and shrink everything else.
      const radius = radii[Math.floor(radii.length * 0.95)] ?? 0;
      if (radius <= 0) return;

      if (mode === "3d" && graph.cameraPosition) {
        // Half of the default 50 degree vertical field of view.
        const distance = (radius / Math.tan((25 * Math.PI) / 180)) * 1.15;
        // Let the framing land before the ambient rotation resumes nudging it.
        suspendOrbit(900);
        graph.cameraPosition(
          { x: cx, y: cy, z: cz + distance },
          { x: cx, y: cy, z: cz },
          700,
        );
      } else {
        graph.zoomToFit?.(700, 80);
      }
    };

    const timers = [1400, 4000, 8000].map((delay) => setTimeout(fit, delay));
    return () => timers.forEach(clearTimeout);
  }, [data.nodes.length, mode, graphRef]);

  // Restyles existing objects in place rather than rebuilding them, so
  // selecting a node never stutters the simulation.
  const nodeCount = data.nodes.length;


  // Read by the coupling force every tick, so new edges take effect without
  // re-registering it.
  const linksRef = useRef(data.links);
  linksRef.current = data.links;

  useEffect(() => {
    applyFocus(focusId, neighbourIds);
    // The 3D links read this on their next frame and ease across with the
    // nodes, so lines and pulses recede together rather than in two stages.
    setLinkFocus(focusId, neighbourIds);
    // data.nodes is read only for its length here: focus restyles objects
    // that already exist, and depending on the array itself would rerun this
    // on every simulation tick.
  }, [focusId, neighbourIds, mode, nodeCount]);

  /**
   * One loop advances every pulse and turns the scene, rather than the
   * renderer re-evaluating a per-link accessor each frame.
   */
  useEffect(() => {
    if (mode !== "3d") return;

    let frame = 0;
    const start = performance.now();
    let previous = start;

    const step = () => {
      const now = performance.now();
      // Clamped: coming back to a backgrounded tab reports one enormous frame,
      // and the scene would jump a quarter turn in a single step.
      const delta = Math.min((now - previous) / 1000, 0.05);
      previous = now;

      const seconds = (now - start) / 1000;
      advancePlasma(seconds);
      if (motion) advanceOrbit(handle, seconds, delta);

      frame = requestAnimationFrame(step);
    };

    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [mode, motion, handle]);

  /**
   * Stand the rotation down while the user is driving the camera themselves.
   *
   * The controls fire these for dragging and for the wheel alike, so any
   * deliberate camera move stops the ambient one instead of fighting it. The
   * pause outlives the gesture by a moment, so releasing a drag does not snap
   * straight back into motion.
   */
  useEffect(() => {
    if (mode !== "3d") return;
    const controls = handle?.controls?.();
    if (!controls?.addEventListener) return;

    const hold = () => holdOrbit("pointer", true);
    const release = () => {
      holdOrbit("pointer", false);
      suspendOrbit(1200);
    };

    controls.addEventListener("start", hold);
    controls.addEventListener("end", release);
    return () => {
      controls.removeEventListener?.("start", hold);
      controls.removeEventListener?.("end", release);
      holdOrbit("pointer", false);
    };
  }, [handle, mode]);

  useEffect(() => disposeSpriteCache, []);
  useEffect(() => disposePlasma, []);

  // Registered imperatively because the force has to attach to the live
  // simulation, and re-registering on every render would reset its phases.
  useEffect(() => {
    const graph = handle;
    if (!graph?.d3Force) return;

    // Deliberately no reheat here. The drift force ignores alpha, and the
    // engine never stops, so it takes effect on the next tick regardless —
    // reheating would slam alpha back to 1 and make the whole layout lurch
    // every time the toggle is clicked.
    graph.d3Force(
      "drift",
      motion ? createDriftForce({ dimensions: mode === "3d" ? 3 : 2 }) : null,
    );

    // Coupling rides with the drift: without motion there is nothing to pass
    // between neighbours, and a permanent spring on a still graph would only
    // fight the settled layout.
    graph.d3Force(
      "living",
      motion
        ? createLivingLinksForce(() => linksRef.current)
        : null,
    );
  }, [motion, handle, mode, nodeCount]);


  const shared = useMemo<ForceGraphProps>(
    () => ({
      graphData: data,
      width,
      height,
      backgroundColor: CANVAS_BACKGROUND,
      nodeId: "id",
      nodeLabel: "",
      // Never auto-stop: the drift force has to keep receiving ticks. Layout
      // forces still fade via alpha decay, so this settles then just breathes.
      // Resolve most of the layout before the first paint, so the graph
      // does not visibly explode outward on load.
      // Heavy damping keeps the drift impulses from accumulating into speed.
      d3VelocityDecay: 0.82,
      // Dragging reheats the layout; a faster decay lets that energy dissipate
      // quickly instead of letting the whole graph churn afterwards.
      d3AlphaDecay: 0.045,
      // Large finite values, NOT Infinity: Infinity here silently breaks the
      // renderer's position sync, leaving every node stuck at the origin.
      cooldownTicks: 1e9,
      cooldownTime: 1e9,
      enableNodeDrag: true,
      linkColor,
      linkWidth,
      linkDirectionalParticles: linkParticles,
      // 3D particles are sphere meshes measured in world units, so they grow
      // as the camera closes in — the library offers no screen-constant size.
      // Kept small enough to read as a travelling dot rather than a bead.
      linkDirectionalParticleWidth: mode === "3d" ? 0.22 : 2.4,
      linkDirectionalParticleSpeed: 0.006,
      // Fewer facets: at this size the silhouette is a dot either way.
      linkDirectionalParticleResolution: 4,
      onNodeHover: (node: GraphNode | null) => {
        // Hold the graph still while a node is under the pointer — both the
        // nodes' own drift and the scene rotation, since either one moving
        // makes the thing you are aiming at a target that walks away.
        setDriftPaused(node !== null);
        holdOrbit("hover", node !== null);
        onHover(node);
      },
      onNodeClick: onSelect,
      nodeVisibility,
      linkVisibility,
      onNodeDragEnd: handleDragEnd,
    }),
    [
      data,
      mode,
      width,
      height,
      linkWidth,
      linkParticles,
      onHover,
      onSelect,
      nodeVisibility,
      linkVisibility,
      handleDragEnd,
      linkColor,
    ],
  );

  if (mode === "3d") {
    return (
      <ForceGraph3D
        innerRef={attach}
        {...shared}
        /*
         * Zero width draws links as plain lines. Any positive width makes the
         * renderer extrude a cylinder per link, which reads as bulky tubes
         * with beads rolling through them rather than the thin flowing traces
         * the 2D view has.
         */
        linkThreeObject={buildLinkObject}
        linkPositionUpdate={updateLinkObject}
        // The plasma shader draws the line itself, so the renderer's own link
        // and particle rendering are both switched off.
        linkDirectionalParticles={0}
        linkWidth={0}
        nodeThreeObject={nodeThreeObject}
        // No linkOpacity: with a custom link object the renderer's own opacity
        // is never applied. Focus dimming lives in the shader instead.
        showNavInfo={false}
      />
    );
  }

  return (
    <ForceGraph2D
      innerRef={attach}
      {...shared}
      nodeColor={nodeColor}
      nodeCanvasObject={paintNode2D}
      nodeCanvasObjectMode={() => "replace"}
    />
  );
}

export const GraphCanvas = memo(GraphCanvasImpl);

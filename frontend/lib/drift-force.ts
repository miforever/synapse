/**
 * Ambient drift, so a settled graph reads as alive rather than frozen.
 *
 * Each node rides a slow sine on its own phase, applied as a velocity nudge.
 * There is deliberately no anchor and no centre term: an earlier version
 * sprang each node toward a remembered home, which collapsed the entire graph
 * to a point whenever those anchors were captured before the layout had
 * resolved. Nothing here references the origin, so drift can never pull the
 * graph inward.
 *
 * Bounded by construction: integrating a sine into velocity yields a cosine in
 * position, and the renderer's velocity decay damps it further, so nodes
 * wobble in place instead of accumulating a direction and wandering off.
 *
 * The force ignores d3's `alpha` on purpose. Layout forces fade as the graph
 * settles; this one must not, or the motion would die with them.
 */

interface SimNode {
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  /** Fixed offset so neighbours never pulse in unison. */
  __phase?: number;
}

interface DriftForce {
  (): void;
  initialize?: (nodes: SimNode[]) => void;
}

// Golden angle, for well-spread phases.
const PHASE_STEP = 2.399963;

// A full cycle takes roughly twenty seconds. Slow enough to read as drifting
// rather than animating, quick enough that the graph is visibly alive.
const RATE_X = 0.31;
const RATE_Y = 0.26;
const RATE_Z = 0.21;

interface Options {
  /** Velocity nudge per tick. Tiny; velocity decay damps it further. */
  strength?: number;
  /** 3 animates z as well; 2 leaves the plane alone. */
  dimensions?: 2 | 3;
}

/**
 * Suspends drift without unregistering the force.
 *
 * Aiming at a node that is still moving is fiddly, so the graph holds still
 * while the pointer is over one. Toggling a flag rather than re-registering
 * keeps each node's phase, so motion resumes from where it left off instead
 * of jumping.
 */
let paused = false;

export function setDriftPaused(value: boolean): void {
  paused = value;
}

/**
 * Whether a memory is currently being dragged.
 *
 * Grabbing one is when the rest of the graph should be at its calmest: you are
 * placing something, and everything around it moving is what makes that hard.
 * The renderer works against this — dragging pins alpha at a high target, so
 * the layout forces surge and the untouched nodes speed *up* exactly when they
 * should settle. Hence two adjustments while a grab is live: the ambient drift
 * runs slow rather than stopping dead, and the calm force below bleeds off the
 * energy the reheat pours in.
 */
let grabbing = false;

/** How much of its normal speed the ambient motion keeps during a grab. */
const GRAB_RATE = 0.7;

export function setGrabbing(value: boolean): void {
  grabbing = value;
}

/*
 * Phase is accumulated rather than read off the wall clock.
 *
 * Slowing the drift by scaling `performance.now()` would jump every node to a
 * different point in its cycle the instant a grab starts. Integrating a rate
 * into a clock of our own means the speed can change without the phase ever
 * discontinuing. Module-level, so switching 2D/3D re-registers the force
 * without resetting the motion.
 */
let clock = 0;
let previous = 0;

export function createDriftForce({
  strength = 0.16,
  dimensions = 3,
}: Options = {}): DriftForce {
  let nodes: SimNode[] = [];

  const force: DriftForce = () => {
    const now = performance.now() / 1000;
    // Clamped: a backgrounded tab reports one enormous frame on return, and
    // the whole graph would lurch through half a cycle in a single tick.
    const delta = previous ? Math.min(now - previous, 0.05) : 0;
    previous = now;

    // Hover holds the graph still; a grab overrides that, since a frozen
    // graph under a moving hand reads as broken rather than as helpful.
    if (paused && !grabbing) return;

    const rate = grabbing ? GRAB_RATE : 1;
    clock += delta * rate;

    const t = clock;
    // Slower *and* gentler: rate alone would keep the same amplitude, so the
    // nodes would travel just as far, only taking longer about it.
    const amplitude = strength * rate;

    for (const node of nodes) {
      // Pinned nodes (dragged into place) stay exactly where they were put.
      if (node.fx !== undefined) continue;

      const phase = node.__phase ?? 0;
      node.vx = (node.vx ?? 0) + Math.sin(t * RATE_X + phase) * amplitude;
      node.vy = (node.vy ?? 0) + Math.cos(t * RATE_Y + phase * 1.3) * amplitude;

      if (dimensions === 3 && node.z !== undefined) {
        node.vz =
          (node.vz ?? 0) + Math.sin(t * RATE_Z + phase * 0.7) * amplitude;
      }
    }
  };

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes;
    nodes.forEach((node, index) => {
      node.__phase = index * PHASE_STEP;
    });
  };

  return force;
}

/**
 * Extra damping applied to everything you are *not* holding.
 *
 * Dragging a node makes the renderer pin the simulation's alpha target high
 * for the duration, which is what lets the graph respond to the drag at all —
 * but it revives the repulsion and link springs across the whole layout, so
 * distant, untouched memories visibly accelerate. This runs each tick while a
 * grab is live and scales the accumulated velocity down, which cancels most of
 * that surge and leaves the rest of the graph drifting slower than it does at
 * rest.
 *
 * Damping velocity rather than opposing the reheat directly: the alpha target
 * belongs to the renderer's drag handler and is reasserted every frame, so
 * anything that tried to hold it down would simply be overwritten.
 *
 * Registered independently of the motion toggle. The surge is the renderer's
 * doing, not the ambient drift's, so it happens whether or not motion is on.
 */
interface CalmForce {
  (): void;
  initialize?: (nodes: SimNode[]) => void;
}

/**
 * Velocity retained per tick during a grab, on top of the renderer's own decay.
 *
 * Enough to take the edge off the reheat without stopping the graph: the point
 * is a canvas that is visibly still drifting while you place something, just
 * slower than it was, since one that freezes under the hand reads as broken.
 */
const CALM_DAMPING = 0.8;

export function createGrabCalmForce(): CalmForce {
  let nodes: SimNode[] = [];

  const force: CalmForce = () => {
    if (!grabbing) return;

    for (const node of nodes) {
      // The dragged node is pinned and driven by the pointer, so damping it
      // would only make it lag behind the cursor.
      if (node.fx !== undefined) continue;

      node.vx = (node.vx ?? 0) * CALM_DAMPING;
      node.vy = (node.vy ?? 0) * CALM_DAMPING;
      if (node.vz !== undefined) node.vz *= CALM_DAMPING;
    }
  };

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes;
  };

  return force;
}

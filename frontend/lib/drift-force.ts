/**
 * Ambient drift, so a settled graph reads as alive rather than frozen.
 *
 * Each node is anchored to its resting position and springs toward a target
 * that traces a slow sine around that anchor. Excursion is therefore bounded
 * by `amplitude` — nodes orbit where they belong and cannot wander off, which
 * pushing velocity around alone does not guarantee.
 *
 * The anchor itself follows the node very slowly, so a genuine layout change
 * (new memories arriving, a filter clearing) is adopted as the new home
 * without the fast motion dragging it.
 *
 * The force ignores d3's `alpha` on purpose. Layout forces fade as the graph
 * settles; this one must not, or the motion would die with them.
 */

interface SimNode {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
  /** Anchor — the position this node drifts around. */
  __hx?: number;
  __hy?: number;
  __hz?: number;
  /** Fixed offset so neighbours never pulse in unison. */
  __phase?: number;
}

interface DriftForce {
  (): void;
  initialize?: (nodes: SimNode[]) => void;
}

// Golden angle, for well-spread phases.
const PHASE_STEP = 2.399963;

// A full cycle takes the better part of a minute. The motion should be
// noticeable only if you watch for it — ambience, not animation.
const RATE_X = 0.11;
const RATE_Y = 0.09;
const RATE_Z = 0.07;

/**
 * How fast the anchor adopts a real layout change. Deliberately tiny: the
 * anchor also sees the node's own drift, so a larger value slowly inflates
 * the orbit. Simulated over 10 minutes, 0.0002 holds excursion to roughly the
 * amplitude, while 0.0015 let it grow to 3x.
 */
const ANCHOR_FOLLOW = 0.0002;

interface Options {
  /** Peak excursion from the anchor, in graph units. */
  amplitude?: number;
  /** Spring constant pulling the node toward its moving target. */
  stiffness?: number;
  /** 3 animates z as well; 2 leaves the plane alone. */
  dimensions?: 2 | 3;
}

export function createDriftForce({
  amplitude = 3,
  stiffness = 0.015,
  dimensions = 3,
}: Options = {}): DriftForce {
  let nodes: SimNode[] = [];

  const force: DriftForce = () => {
    const t = performance.now() / 1000;

    for (const node of nodes) {
      // Pinned nodes (dragged into place) stay exactly where they were put.
      if (node.fx !== undefined) continue;
      if (node.x === undefined || node.y === undefined) continue;

      // Adopt the current position as the anchor the first time we see it.
      node.__hx ??= node.x;
      node.__hy ??= node.y;

      node.__hx += (node.x - node.__hx) * ANCHOR_FOLLOW;
      node.__hy += (node.y - node.__hy) * ANCHOR_FOLLOW;

      const phase = node.__phase ?? 0;

      const targetX = node.__hx + Math.sin(t * RATE_X + phase) * amplitude;
      const targetY = node.__hy + Math.cos(t * RATE_Y + phase * 1.3) * amplitude;

      node.vx = (node.vx ?? 0) + (targetX - node.x) * stiffness;
      node.vy = (node.vy ?? 0) + (targetY - node.y) * stiffness;

      if (dimensions === 3 && node.z !== undefined) {
        node.__hz ??= node.z;
        node.__hz += (node.z - node.__hz) * ANCHOR_FOLLOW;

        const targetZ = node.__hz + Math.sin(t * RATE_Z + phase * 0.7) * amplitude;
        node.vz = (node.vz ?? 0) + (targetZ - node.z) * stiffness;
      }
    }
  };

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes;
    nodes.forEach((node, index) => {
      node.__phase = index * PHASE_STEP;
      // Clear stale anchors so a re-registered force re-homes to wherever the
      // nodes actually are now.
      node.__hx = node.__hy = node.__hz = undefined;
    });
  };

  return force;
}

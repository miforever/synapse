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

// A full cycle takes the better part of a minute. The motion should be
// noticeable only if you watch for it — ambience, not animation.
const RATE_X = 0.11;
const RATE_Y = 0.09;
const RATE_Z = 0.07;

interface Options {
  /** Velocity nudge per tick. Tiny; velocity decay damps it further. */
  strength?: number;
  /** 3 animates z as well; 2 leaves the plane alone. */
  dimensions?: 2 | 3;
}

export function createDriftForce({
  strength = 0.05,
  dimensions = 3,
}: Options = {}): DriftForce {
  let nodes: SimNode[] = [];

  const force: DriftForce = () => {
    const t = performance.now() / 1000;

    for (const node of nodes) {
      // Pinned nodes (dragged into place) stay exactly where they were put.
      if (node.fx !== undefined) continue;

      const phase = node.__phase ?? 0;
      node.vx = (node.vx ?? 0) + Math.sin(t * RATE_X + phase) * strength;
      node.vy = (node.vy ?? 0) + Math.cos(t * RATE_Y + phase * 1.3) * strength;

      if (dimensions === 3 && node.z !== undefined) {
        node.vz = (node.vz ?? 0) + Math.sin(t * RATE_Z + phase * 0.7) * strength;
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

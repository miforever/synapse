/**
 * Keeps connected memories moving together after the layout has cooled.
 *
 * d3's link force is scaled by `alpha`, so once the graph settles it stops
 * acting and the drift moves every node independently — the canvas looks
 * inert. Dragging reheats alpha and the whole graph springs back to life,
 * which is the quality worth having all the time, just slower.
 *
 * This shares a little velocity along each edge rather than applying a spring
 * toward a rest length. That distinction matters: a permanent spring has no
 * permanent repulsion opposing it once alpha decays, so it slowly draws the
 * whole graph inward and everything bunches up. Exchanging momentum is
 * neutral with respect to distance — it can transmit motion between
 * neighbours but cannot change how far apart they settle.
 *
 * Momentum is exchanged symmetrically, so the pair's total is conserved and
 * energy cannot accumulate.
 */

interface SimNode {
  vx?: number;
  vy?: number;
  vz?: number;
  z?: number;
  fx?: number;
}

interface SimLink {
  source: SimNode | string;
  target: SimNode | string;
}

interface LivingLinksForce {
  (): void;
  initialize?: (nodes: SimNode[]) => void;
}

function resolved(endpoint: SimNode | string): SimNode | null {
  // Endpoints are strings until the simulation swaps in node references.
  return typeof endpoint === "object" ? endpoint : null;
}

interface Options {
  /**
   * Fraction of the velocity difference exchanged per tick.
   *
   * Must stay well below 1: this runs every frame, so even a modest value
   * compounds. Anything at or above 2 amplifies rather than shares, and
   * velocities diverge to infinity within a few frames — enough to kill the
   * renderer process outright.
   */
  coupling?: number;
}

/** Above this the exchange amplifies instead of sharing. */
const MAX_COUPLING = 0.5;

export function createLivingLinksForce(
  getLinks: () => SimLink[],
  { coupling = 0.06 }: Options = {},
): LivingLinksForce {
  // Named options rather than a positional number, and clamped: passing the
  // wrong quantity here is not a subtle bug, it crashes the tab.
  const rate = Math.min(Math.max(coupling, 0), MAX_COUPLING);
  const force: LivingLinksForce = () => {
    for (const link of getLinks()) {
      const source = resolved(link.source);
      const target = resolved(link.target);
      if (!source || !target) continue;

      // Half the velocity difference, applied in opposite directions: the pair
      // drifts toward a shared motion without either being pulled anywhere.
      const shareX = ((target.vx ?? 0) - (source.vx ?? 0)) * rate * 0.5;
      const shareY = ((target.vy ?? 0) - (source.vy ?? 0)) * rate * 0.5;
      const shareZ = ((target.vz ?? 0) - (source.vz ?? 0)) * rate * 0.5;

      if (source.fx === undefined) {
        source.vx = (source.vx ?? 0) + shareX;
        source.vy = (source.vy ?? 0) + shareY;
        if (source.z !== undefined) source.vz = (source.vz ?? 0) + shareZ;
      }
      if (target.fx === undefined) {
        target.vx = (target.vx ?? 0) - shareX;
        target.vy = (target.vy ?? 0) - shareY;
        if (target.z !== undefined) target.vz = (target.vz ?? 0) - shareZ;
      }
    }
  };

  // Nothing to cache: links are read fresh each tick so live edges are picked
  // up without re-registering the force.
  force.initialize = () => undefined;

  return force;
}

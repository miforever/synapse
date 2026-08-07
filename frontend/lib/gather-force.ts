/**
 * A gentle pull toward the middle, so the graph settles as one object.
 *
 * Repulsion pushes until the links stop it, which leaves a sparse graph
 * drifting into a scatter. This gives the layout something to settle against.
 *
 * Two things make it safe where d3.forceCenter was not: it pulls toward the
 * centroid, so it never translates the graph, and it is scaled by `alpha`, so
 * it fades as the layout cools. An inward pull that ignores alpha keeps
 * pulling with nothing left to oppose it, which collapses the graph to a
 * point.
 */

interface SimNode {
  x?: number;
  y?: number;
  z?: number;
  vx?: number;
  vy?: number;
  vz?: number;
  fx?: number;
}

interface GatherForce {
  (alpha: number): void;
  initialize?: (nodes: SimNode[]) => void;
}

interface Options {
  /** How hard, at full temperature. Small: the layout forces do the work. */
  strength?: number;
  /** 3 gathers in space as well; 2 leaves depth alone. */
  dimensions?: 2 | 3;
}

export function createGatherForce({
  strength = 0.045,
  dimensions = 3,
}: Options = {}): GatherForce {
  let nodes: SimNode[] = [];

  const force: GatherForce = (alpha: number) => {
    if (nodes.length === 0) return;

    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const node of nodes) {
      cx += node.x ?? 0;
      cy += node.y ?? 0;
      cz += node.z ?? 0;
    }
    cx /= nodes.length;
    cy /= nodes.length;
    cz /= nodes.length;

    const pull = strength * alpha;

    for (const node of nodes) {
      // A memory placed by hand stays where it was put.
      if (node.fx !== undefined) continue;

      node.vx = (node.vx ?? 0) - ((node.x ?? 0) - cx) * pull;
      node.vy = (node.vy ?? 0) - ((node.y ?? 0) - cy) * pull;
      if (dimensions === 3 && node.z !== undefined) {
        node.vz = (node.vz ?? 0) - ((node.z ?? 0) - cz) * pull;
      }
    }
  };

  force.initialize = (simNodes: SimNode[]) => {
    nodes = simNodes;
  };

  return force;
}

/**
 * Which connections stay lit while a memory is open.
 *
 * One definition for both canvases: 2D dims by picking a fainter stroke, 3D by
 * feeding the plasma shader a lower brightness, but the rule about *what* to
 * dim has to be identical or the two views disagree about the same graph.
 */

/** Endpoints arrive as ids and are swapped for node objects by the simulation. */
export type LinkEnd = string | { id: string };

export interface FocusLink {
  source: LinkEnd;
  target: LinkEnd;
}

export function endOf(value: LinkEnd): string {
  return typeof value === "object" ? value.id : value;
}

/**
 * With nothing open, everything is lit.
 *
 * Otherwise a connection stays lit if it touches the open memory, or if it
 * runs between two of its neighbours — that second case is what makes the
 * neighbourhood read as a shape rather than a spray of lines out of one point.
 */
export function isLinkLit(
  link: FocusLink,
  focusId: string | null,
  neighbours: ReadonlySet<string>,
): boolean {
  if (!focusId) return true;

  const source = endOf(link.source);
  const target = endOf(link.target);

  return (
    source === focusId ||
    target === focusId ||
    (neighbours.has(source) && neighbours.has(target))
  );
}

/**
 * Whether a connection runs out of the memory under the pointer.
 *
 * Hover is a lighter gesture than opening a memory: it lifts the node's own
 * connections rather than pushing everything else back, so only the edges that
 * actually touch it count — the neighbour-to-neighbour edges that focus keeps
 * lit would spread the highlight past what the pointer is pointing at.
 */
export function isLinkHovered(
  link: FocusLink,
  hoverId: string | null,
): boolean {
  if (!hoverId) return false;
  return endOf(link.source) === hoverId || endOf(link.target) === hoverId;
}

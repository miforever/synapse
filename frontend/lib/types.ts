/** Mirrors the projections in the daemon's app/models/graph.py. */

export type RelationType = "depends_on" | "relates_to" | "blocks" | "part_of";

export interface GraphNode {
  id: string;
  type: string;
  title: string;
  summary: string;
  thumbnail_url: string | null;
  tags: string[];
}

export interface GraphEdge {
  id: string;
  source: string;
  target: string;
  relation_type: RelationType;
  weight: number;
}

export interface GraphSnapshot {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

/** The full record, fetched only when a node is opened. */
export interface NodeDetail extends GraphNode {
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** Lightweight search hit — no Markdown body. */
export interface NodeSearchResult {
  id: string;
  type: string;
  title: string;
  summary: string;
}

/** Mirrors app/models/settings.py — the user's rendering preferences. */
export interface MediaSettings {
  images: boolean;
  audio: boolean;
  video: boolean;
  remote_sources: boolean;
}

export interface AppSettings {
  media: MediaSettings;
}

export const EVENT_NEW_NODE = "EVENT_NEW_NODE";
export const EVENT_NODE_UPDATED = "EVENT_NODE_UPDATED";
export const EVENT_NODE_DELETED = "EVENT_NODE_DELETED";

export type GraphEvent =
  | { event: typeof EVENT_NEW_NODE; payload: { node: GraphNode; edges: GraphEdge[] } }
  | { event: typeof EVENT_NODE_UPDATED; payload: { node: GraphNode } }
  | { event: typeof EVENT_NODE_DELETED; payload: { node_id: string } };

export interface GraphEventHandlers {
  onNewNode: (node: GraphNode, edges: GraphEdge[]) => void;
  onNodeUpdated: (node: GraphNode) => void;
  onNodeDeleted: (nodeId: string) => void;
}

/**
 * The renderer mutates links in place, swapping the string endpoints for node
 * object references once the simulation runs. Reads must tolerate both.
 */
export type LinkEndpoint = string | GraphNode;

export function endpointId(endpoint: LinkEndpoint): string {
  return typeof endpoint === "string" ? endpoint : endpoint.id;
}

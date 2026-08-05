import type {
  GraphSnapshot,
  NodeDetail,
  NodeSearchResult,
  SavedLayout,
} from "./types";

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export const WS_URL = API_URL.replace(/^http/, "ws") + "/ws/graph";

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, { signal });
  if (!response.ok) {
    throw new Error(`${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export function fetchGraph(signal?: AbortSignal): Promise<GraphSnapshot> {
  return get<GraphSnapshot>("/graph", signal);
}

export function fetchNode(
  id: string,
  signal?: AbortSignal,
): Promise<NodeDetail> {
  return get<NodeDetail>(`/nodes/${encodeURIComponent(id)}`, signal);
}

export function fetchLayout(
  mode: string,
  signal?: AbortSignal,
): Promise<SavedLayout> {
  return get<SavedLayout>(`/layout/${mode}`, signal);
}

/**
 * Write the arrangement back.
 *
 * `keepalive` so a save fired as the page goes away is still delivered — an
 * ordinary fetch is cancelled when the document unloads, which is exactly the
 * moment the last arrangement needs saving.
 */
export function saveLayout(
  mode: string,
  positions: SavedLayout["positions"],
): Promise<Response> {
  return fetch(`${API_URL}/layout/${mode}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ positions }),
    keepalive: true,
  });
}

export function clearLayout(mode: string): Promise<Response> {
  return fetch(`${API_URL}/layout/${mode}`, { method: "DELETE" });
}

export function searchNodes(
  query: string,
  signal?: AbortSignal,
): Promise<NodeSearchResult[]> {
  return get<NodeSearchResult[]>(
    `/search?q=${encodeURIComponent(query)}&limit=20`,
    signal,
  );
}

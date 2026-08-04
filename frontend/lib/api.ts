import type { GraphSnapshot, NodeDetail } from "./types";

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

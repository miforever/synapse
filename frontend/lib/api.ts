import type {
  FileRef,
  GraphSnapshot,
  NodeDetail,
  NodeSearchResult,
  SavedLayout,
  Status,
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

/**
 * The graph, or only what changed since a previous read.
 *
 * `since` is the `as_of` the daemon returned last time. It answers with the
 * memories written or edited, the edges added, and the ids of anything
 * deleted — so a browser holding a cached graph pays for the difference.
 */
export function fetchGraph(
  signal?: AbortSignal,
  since?: string,
): Promise<GraphSnapshot> {
  const path = since ? `/graph?since=${encodeURIComponent(since)}` : "/graph";
  return get<GraphSnapshot>(path, signal);
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

/** Absolute address of an attachment, for an <img> or a link. */
export function fileUrl(file: Pick<FileRef, "url">): string {
  return `${API_URL}${file.url}`;
}

/**
 * Attach a file to a memory.
 *
 * multipart rather than a JSON body: the bytes go up as bytes, instead of
 * being base64'd into a string a third larger than the file itself. The
 * daemon broadcasts the change, so every open canvas picks the attachment up
 * without this having to tell anyone.
 */
export async function attachFile(
  nodeId: string,
  file: File,
): Promise<FileRef> {
  const body = new FormData();
  body.append("upload", file, file.name);

  const response = await fetch(
    `${API_URL}/nodes/${encodeURIComponent(nodeId)}/files`,
    { method: "POST", body },
  );
  if (!response.ok) {
    throw new Error(
      response.status === 413
        ? `${file.name} is too large for this daemon`
        : `Could not attach ${file.name}`,
    );
  }
  return response.json() as Promise<FileRef>;
}

/**
 * Move a piece of work along.
 *
 * The canvas's first write. It goes through the same PATCH the agents use, so
 * a status set by hand and one set by an agent are the same edit — including
 * the broadcast, which is how every other open view finds out.
 */
export async function setNodeStatus(
  nodeId: string,
  status: Status,
): Promise<NodeDetail> {
  const response = await fetch(
    `${API_URL}/nodes/${encodeURIComponent(nodeId)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    },
  );
  if (!response.ok) throw new Error("Could not update the status");
  return response.json() as Promise<NodeDetail>;
}

export async function detachFile(fileId: string): Promise<void> {
  const response = await fetch(
    `${API_URL}/files/${encodeURIComponent(fileId)}`,
    { method: "DELETE" },
  );
  if (!response.ok) throw new Error("Could not remove the attachment");
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

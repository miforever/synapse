/**
 * The last graph this browser saw, kept so a reload pays for the difference
 * rather than for the whole store.
 *
 * IndexedDB rather than localStorage: a graph of a few thousand memories is
 * megabytes of JSON, and localStorage's ~5MB quota would start failing at
 * exactly the size where caching matters. It is synchronous besides.
 *
 * Everything here fails soft — storage denied, quota refused, an unreadable
 * entry — by falling back to fetching the whole graph.
 */

import type { GraphSnapshot } from "./types";

const DB_NAME = "synapsse";
const STORE = "graph";
/** Bumped when the cached shape changes, so an old entry is ignored. */
const VERSION = 1;
const KEY = "snapshot";

export interface CachedGraph extends GraphSnapshot {
  /** What to pass as `since` on the next read. */
  as_of: string;
}

function open(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);

  return new Promise((resolve) => {
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME, VERSION);
    } catch {
      resolve(null);
      return;
    }

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
    // Another tab holding an older version open. Not worth waiting on — this
    // load just goes to the network.
    request.onblocked = () => resolve(null);
  });
}

export async function loadCachedGraph(): Promise<CachedGraph | null> {
  const db = await open();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY);
      request.onsuccess = () => {
        const value = request.result as CachedGraph | undefined;
        // A cache with no `as_of` cannot be brought up to date, so it is no
        // use as a starting point.
        resolve(value?.as_of ? value : null);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    } finally {
      db.close();
    }
  });
}

export async function saveCachedGraph(graph: CachedGraph): Promise<void> {
  const db = await open();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const transaction = db.transaction(STORE, "readwrite");
      transaction.objectStore(STORE).put(graph, KEY);
      // Resolving either way: a failed write costs a full fetch next time and
      // nothing else, which is not worth surfacing to the person reading their
      // graph.
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => resolve();
      transaction.onabort = () => resolve();
    } catch {
      resolve();
    } finally {
      db.close();
    }
  });
}

/**
 * Fold a delta into what was cached.
 *
 * Nodes and edges are replaced by id rather than appended, because an edited
 * memory arrives as the same id with new text — appending would leave the
 * canvas drawing both versions.
 */
export function applyDelta(
  cached: GraphSnapshot,
  delta: GraphSnapshot,
): GraphSnapshot {
  const removed = new Set(delta.deleted ?? []);

  const nodes = new Map(
    cached.nodes.filter((node) => !removed.has(node.id)).map((n) => [n.id, n]),
  );
  for (const node of delta.nodes) nodes.set(node.id, node);

  const edges = new Map(
    cached.edges
      // Edges of a deleted memory go with it: the daemon cascades them away,
      // and it does not send a tombstone for each one.
      .filter(
        (edge) =>
          !removed.has(endpointOf(edge.source)) &&
          !removed.has(endpointOf(edge.target)),
      )
      .map((edge) => [edge.id, edge]),
  );
  for (const edge of delta.edges) edges.set(edge.id, edge);

  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/** Endpoints are ids in a cached snapshot, node objects once simulated. */
function endpointOf(value: string | { id: string }): string {
  return typeof value === "string" ? value : value.id;
}

"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { fetchNode } from "@/lib/api";
import { colorForClass, labelForClass } from "@/lib/node-classes";
import type {
  GraphEdge,
  GraphNode,
  MediaSettings,
  NodeDetail,
} from "@/lib/types";
import { endpointId } from "@/lib/types";
import { MemoryContent } from "./MemoryContent";

interface Props {
  node: GraphNode | null;
  edges: GraphEdge[];
  /** Resolves edge endpoints to real memories — an id alone tells you nothing. */
  nodesById: Map<string, GraphNode>;
  media: MediaSettings;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

export function NodeDrawer({
  node,
  edges,
  nodesById,
  media,
  onClose,
  onNavigate,
}: Props) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  // Sticky across nodes on purpose: someone traversing the graph wants the
  // connection list to stay however they left it.
  const [showConnections, setShowConnections] = useState(true);

  useEffect(() => {
    if (!node) return;

    setDetail(null);
    const controller = new AbortController();
    fetchNode(node.id, controller.signal)
      .then(setDetail)
      .catch(() => setDetail(null));

    return () => controller.abort();
  }, [node]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const related = node
    ? edges.filter(
        (edge) =>
          endpointId(edge.source) === node.id ||
          endpointId(edge.target) === node.id,
      )
    : [];

  return (
    <AnimatePresence>
      {node && (
        <motion.aside
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 30, stiffness: 260 }}
          className="glass-panel absolute right-0 top-0 z-30 flex h-full w-full max-w-md flex-col border-l"
        >
          <header className="flex shrink-0 items-start gap-3 border-b border-white/10 p-5">
            <span
              className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
              style={{ backgroundColor: colorForClass(node.type) }}
            />
            <div className="min-w-0 flex-1">
              <span
                className="font-mono text-[10px] uppercase tracking-[0.2em]"
                style={{ color: colorForClass(node.type) }}
              >
                {labelForClass(node.type)}
              </span>
              <h2 className="mt-1 text-lg font-semibold leading-tight text-white">
                {node.title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close (Esc)"
              className="shrink-0 rounded-md px-2 py-1 font-mono text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
              ✕
            </button>
          </header>

          {/* Only the reading area scrolls, so connections never drift out of
              reach behind a long memory. */}
          <div className="min-h-0 flex-1 overflow-y-auto p-5">
            <p className="text-sm italic leading-relaxed text-slate-400">
              {node.summary}
            </p>

            {node.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-1.5">
                {node.tags.map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] text-slate-300"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="mt-5 border-t border-white/10 pt-5">
              {detail ? (
                <MemoryContent content={detail.content} media={media} />
              ) : (
                <p className="font-mono text-xs text-slate-500">loading…</p>
              )}
            </div>
          </div>

          {/* Pinned below the content: navigation stays one glance away
              whatever the memory's length, and collapses when the reader
              wants the room back. */}
          {related.length > 0 && (
            <section className="shrink-0 border-t border-white/10 bg-black/20">
              <button
                type="button"
                onClick={() => setShowConnections((open) => !open)}
                aria-expanded={showConnections}
                className="flex w-full items-center justify-between px-5 py-3 transition hover:bg-white/5"
              >
                <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
                  Connections
                  <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-slate-300">
                    {related.length}
                  </span>
                </span>
                <span
                  className={`font-mono text-[10px] text-slate-500 transition-transform ${
                    showConnections ? "" : "-rotate-90"
                  }`}
                >
                  ▾
                </span>
              </button>

              <AnimatePresence initial={false}>
                {showConnections && (
                  <motion.ul
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    // Capped so a heavily linked memory cannot swallow the
                    // whole drawer; it scrolls within its own space instead.
                    className="max-h-52 space-y-0.5 overflow-y-auto px-3 pb-3"
                  >
                    {related.map((edge) => {
                      const outgoing = endpointId(edge.source) === node.id;
                      const otherId = outgoing
                        ? endpointId(edge.target)
                        : endpointId(edge.source);
                      const other = nodesById.get(otherId);

                      return (
                        <li key={edge.id}>
                          <button
                            type="button"
                            onClick={() => onNavigate(otherId)}
                            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition hover:bg-white/10"
                          >
                            <span
                              className="h-1.5 w-1.5 shrink-0 rounded-full"
                              style={{
                                backgroundColor: colorForClass(
                                  other?.type ?? "fact",
                                ),
                              }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-xs text-slate-200">
                                {other?.title ?? "Unknown memory"}
                              </span>
                              <span className="block font-mono text-[10px] text-slate-500">
                                {outgoing ? "→" : "←"} {edge.relation_type}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </motion.ul>
                )}
              </AnimatePresence>
            </section>
          )}
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

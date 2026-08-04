"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useState } from "react";

import { fetchNode } from "@/lib/api";
import { colorForClass, labelForClass } from "@/lib/node-classes";
import type { GraphEdge, GraphNode, NodeDetail } from "@/lib/types";
import { endpointId } from "@/lib/types";
import { MemoryContent } from "./MemoryContent";
import type { MediaSettings } from "@/lib/types";

interface Props {
  node: GraphNode | null;
  edges: GraphEdge[];
  media: MediaSettings;
  onClose: () => void;
  onNavigate: (nodeId: string) => void;
}

export function NodeDrawer({ node, edges, media, onClose, onNavigate }: Props) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);

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
          <header className="flex items-start gap-3 border-b border-white/10 p-5">
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
              className="rounded-md px-2 py-1 font-mono text-xs text-slate-400 transition hover:bg-white/10 hover:text-white"
            >
               esc
            </button>
          </header>

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

            {related.length > 0 && (
              <div className="mt-6 border-t border-white/10 pt-5">
                <h3 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                  Connections
                </h3>
                <ul className="mt-3 space-y-1.5">
                  {related.map((edge) => {
                    const otherId =
                      endpointId(edge.source) === node.id
                        ? endpointId(edge.target)
                        : endpointId(edge.source);
                    return (
                      <li key={edge.id}>
                        <button
                          type="button"
                          onClick={() => onNavigate(otherId)}
                          className="w-full truncate rounded-md px-2 py-1.5 text-left font-mono text-[11px] text-slate-300 transition hover:bg-white/10"
                        >
                          <span className="text-slate-500">
                            {edge.relation_type}
                          </span>{" "}
                          {otherId.slice(0, 8)}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}

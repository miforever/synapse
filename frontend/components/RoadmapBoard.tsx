"use client";

import { colorForClass, labelForClass } from "@/lib/node-classes";
import {
  LANE_HINTS,
  LANE_LABELS,
  LANES,
  relativeDate,
  type Roadmap,
  type RoadmapItem,
} from "@/lib/roadmap";
import type { GraphNode } from "@/lib/types";

interface Props {
  roadmap: Roadmap;
  onOpen: (node: GraphNode) => void;
}

/**
 * Work in lanes, with what each piece is waiting on.
 *
 * The dependency is shown as the *name* of the thing blocking it rather than
 * as a line drawn between columns. Lines across a board that scrolls in two
 * directions are decoration — you cannot follow one to a card you cannot see —
 * where a name tells you what to go and look at.
 */
export function RoadmapBoard({ roadmap, onOpen }: Props) {
  if (roadmap.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-32 text-center">
        <p className="text-sm text-slate-400">Nothing on the roadmap yet.</p>
        <p className="max-w-md text-xs leading-relaxed text-slate-600">
          A memory joins the board when it is given a status — ask an agent to{" "}
          <code className="font-mono text-slate-500">set_status</code> on a plan
          it is working through, or pass one when the memory is written.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 p-6 md:grid-cols-2 xl:grid-cols-4">
      {LANES.map((lane) => (
        <section key={lane} className="min-w-0">
          <div className="mb-2 flex items-baseline gap-2">
            <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
              {LANE_LABELS[lane]}
            </h2>
            <span className="rounded-full bg-white/10 px-1.5 py-0.5 font-mono text-[9px] text-slate-300">
              {roadmap.lanes[lane].length}
            </span>
          </div>
          <p className="mb-3 text-[10px] leading-snug text-slate-600">
            {LANE_HINTS[lane]}
          </p>

          <ul className="space-y-2">
            {roadmap.lanes[lane].map((item) => (
              <li key={item.node.id}>
                <Card item={item} roadmap={roadmap} onOpen={onOpen} />
              </li>
            ))}

            {roadmap.lanes[lane].length === 0 && (
              <li className="rounded-lg border border-dashed border-white/5 px-3 py-4 text-center font-mono text-[10px] text-slate-700">
                empty
              </li>
            )}
          </ul>
        </section>
      ))}
    </div>
  );
}

function Card({
  item,
  roadmap,
  onOpen,
}: {
  item: RoadmapItem;
  roadmap: Roadmap;
  onOpen: (node: GraphNode) => void;
}) {
  const { node, blockedBy, blocking, overdue } = item;
  const colour = colorForClass(node.type);
  // Finished and abandoned work recedes: the board is read for what is next,
  // and the two lanes that are behind you should not compete for that.
  const settled = node.status === "done" || node.status === "dropped";

  return (
    <button
      type="button"
      onClick={() => onOpen(node)}
      className={`w-full rounded-xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/20 hover:bg-white/10 ${
        settled ? "opacity-60 hover:opacity-100" : ""
      }`}
    >
      <span className="flex items-center gap-1.5">
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ backgroundColor: colour }}
        />
        <span
          className="font-mono text-[9px] uppercase tracking-[0.2em]"
          style={{ color: colour }}
        >
          {labelForClass(node.type)}
        </span>
      </span>

      <span className="mt-1.5 block text-sm font-medium leading-snug text-white">
        {node.title}
      </span>

      <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
        {node.summary}
      </span>

      {node.target_date && (
        <span
          className={`mt-2 flex items-center gap-1.5 font-mono text-[10px] ${
            overdue ? "text-rose-300" : "text-slate-500"
          }`}
        >
          <span aria-hidden>{overdue ? "⚠" : "◷"}</span>
          {node.target_date}
          <span className={overdue ? "text-rose-400/70" : "text-slate-600"}>
            {relativeDate(node.target_date)}
          </span>
        </span>
      )}

      {blockedBy.length > 0 && (
        <span className="mt-2 block border-t border-white/5 pt-2">
          <span className="block font-mono text-[9px] uppercase tracking-widest text-amber-300/70">
            Waiting on
          </span>
          {blockedBy.map((id) => (
            <span
              key={id}
              className="mt-0.5 block truncate text-[10px] text-slate-400"
            >
              {roadmap.byId.get(id)?.node.title ?? "unknown"}
            </span>
          ))}
        </span>
      )}

      {blocking.length > 0 && (
        <span className="mt-1.5 block font-mono text-[9px] text-slate-600">
          blocks {blocking.length}{" "}
          {blocking.length === 1 ? "other" : "others"}
        </span>
      )}
    </button>
  );
}

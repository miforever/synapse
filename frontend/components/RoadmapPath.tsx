"use client";

import { colorForClass, labelForClass } from "@/lib/node-classes";
import { relativeDate, type RoadmapItem } from "@/lib/roadmap";
import { progressOf, type RoadmapPath as Path } from "@/lib/roadmap-path";
import type { GraphNode } from "@/lib/types";

interface Props {
  path: Path;
  onOpen: (node: GraphNode) => void;
}

/**
 * The work as a path — what has to happen before what.
 *
 * Read top to bottom: each row is a step, and everything within a row can be
 * done at the same time. The spine down the left is what makes it a path
 * rather than a list, and it fills in as the steps are finished, so how far
 * along the plan is can be read at a glance without counting cards.
 *
 * Cards are not draggable here. On the board a card's column *is* its status,
 * so dragging says something; here a card's position is derived from the
 * dependency graph, and moving it would be asking to change an edge — a
 * different operation that deserves its own gesture rather than a surprising
 * reinterpretation of this one.
 */
export function RoadmapPath({ path, onOpen }: Props) {
  if (path.total === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 px-6 py-32 text-center">
        <p className="text-sm text-slate-400">No steps to lay out yet.</p>
        <p className="max-w-md text-xs leading-relaxed text-slate-600">
          Work appears here once it has a status, and falls into order once
          memories are linked with <code className="font-mono">depends_on</code>{" "}
          or <code className="font-mono">blocks</code>.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {path.steps.map((step, index) => {
        const state = progressOf(step);
        const last = index === path.steps.length - 1;

        return (
          <div key={step.level} className="relative flex gap-5">
            {/* The spine: a marker for the step and the line to the next. */}
            <div className="flex w-6 shrink-0 flex-col items-center">
              <span
                className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px] ${
                  state === "done"
                    ? "border-emerald-400/40 bg-emerald-400/20 text-emerald-200"
                    : state === "doing"
                      ? "border-cyan/40 bg-cyan/15 text-cyan"
                      : "border-white/15 bg-white/5 text-slate-500"
                }`}
              >
                {state === "done" ? "✓" : index + 1}
              </span>
              {!last && (
                <span
                  className={`w-px flex-1 ${
                    state === "done" ? "bg-emerald-400/30" : "bg-white/10"
                  }`}
                />
              )}
            </div>

            <div className={`min-w-0 flex-1 ${last ? "pb-2" : "pb-6"}`}>
              <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
                Step {index + 1}
                {step.items.length > 1 && (
                  <span className="ml-2 text-slate-700">
                    · {step.items.length} in parallel
                  </span>
                )}
              </p>

              <div className="grid gap-2 sm:grid-cols-2">
                {step.items.map((item) => (
                  <Step key={item.node.id} item={item} onOpen={onOpen} />
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {path.cyclic.length > 0 && (
        <section className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-amber-300/80">
            Waiting on each other
          </p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            These have no place in the order, because their dependencies form a
            loop. Something in the chain needs unlinking.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {path.cyclic.map((item) => (
              <Step key={item.node.id} item={item} onOpen={onOpen} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Step({
  item,
  onOpen,
}: {
  item: RoadmapItem;
  onOpen: (node: GraphNode) => void;
}) {
  const { node, overdue } = item;
  const colour = colorForClass(node.type);
  const done = node.status === "done";

  return (
    <button
      type="button"
      onClick={() => onOpen(node)}
      className={`rounded-xl border p-3 text-left transition ${
        done
          ? "border-white/5 bg-white/[0.02] opacity-60 hover:opacity-100"
          : node.status === "doing"
            ? "border-cyan/30 bg-cyan/5 hover:border-cyan/50"
            : "border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/10"
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
        {node.status === "doing" && (
          <span className="ml-auto font-mono text-[9px] uppercase tracking-widest text-cyan">
            now
          </span>
        )}
      </span>

      <span
        className={`mt-1.5 block text-sm font-medium leading-snug ${
          done ? "text-slate-400 line-through decoration-white/20" : "text-white"
        }`}
      >
        {node.title}
      </span>

      <span className="mt-1 line-clamp-2 block text-[11px] leading-relaxed text-slate-500">
        {node.summary}
      </span>

      {node.target_date && !done && (
        <span
          className={`mt-2 block font-mono text-[10px] ${
            overdue ? "text-rose-300" : "text-slate-500"
          }`}
        >
          {overdue ? "⚠ " : "◷ "}
          {node.target_date} · {relativeDate(node.target_date)}
        </span>
      )}
    </button>
  );
}

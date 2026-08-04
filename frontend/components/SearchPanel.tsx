"use client";

import { AnimatePresence, motion } from "framer-motion";

import { useSearch } from "@/hooks/useSearch";
import { colorForClass, labelForClass } from "@/lib/node-classes";
import type { NodeSearchResult } from "@/lib/types";

interface Props {
  query: string;
  onQueryChange: (query: string) => void;
  classes: string[];
  tags: string[];
  activeClasses: Set<string>;
  activeTags: Set<string>;
  onToggleClass: (name: string) => void;
  onToggleTag: (name: string) => void;
  onSelectResult: (nodeId: string) => void;
  matchCount: number | null;
}

function Chip({
  label,
  color,
  active,
  onClick,
}: {
  label: string;
  color?: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] transition ${
        active
          ? "border-white/25 bg-white/10 text-white"
          : "border-white/10 text-slate-500 hover:text-slate-300"
      }`}
    >
      {color && (
        <span
          className="h-1.5 w-1.5 rounded-full"
          style={{ backgroundColor: color, opacity: active ? 1 : 0.5 }}
        />
      )}
      {label}
    </button>
  );
}

export function SearchPanel({
  query,
  onQueryChange,
  classes,
  tags,
  activeClasses,
  activeTags,
  onToggleClass,
  onToggleTag,
  onSelectResult,
  matchCount,
}: Props) {
  const { results, searching } = useSearch(query);

  return (
    <div className="glass-panel absolute right-5 top-5 z-20 w-80 rounded-xl p-4">
      <input
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        placeholder="Search memories…"
        aria-label="Search memories"
        className="w-full rounded-lg border border-white/10 bg-black/30 px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:border-cyan/40 focus:outline-none"
      />

      <AnimatePresence>
        {query.trim() && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <ul className="mt-2 max-h-64 space-y-0.5 overflow-y-auto">
              {results.map((result: NodeSearchResult) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => onSelectResult(result.id)}
                    className="w-full rounded-md px-2 py-1.5 text-left transition hover:bg-white/10"
                  >
                    <span className="flex items-center gap-1.5">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full"
                        style={{ backgroundColor: colorForClass(result.type) }}
                      />
                      <span className="truncate text-xs text-slate-200">
                        {result.title}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate pl-3 text-[10px] text-slate-500">
                      {result.summary}
                    </span>
                  </button>
                </li>
              ))}

              {!searching && results.length === 0 && (
                <li className="px-2 py-1.5 font-mono text-[10px] text-slate-600">
                  no matches
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {classes.length > 0 && (
        <div className="mt-3 border-t border-white/10 pt-3">
          <div className="flex flex-wrap gap-1">
            {classes.map((name) => (
              <Chip
                key={name}
                label={labelForClass(name)}
                color={colorForClass(name)}
                active={activeClasses.has(name)}
                onClick={() => onToggleClass(name)}
              />
            ))}
          </div>
        </div>
      )}

      {tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {tags.map((name) => (
            <Chip
              key={name}
              label={`#${name}`}
              active={activeTags.has(name)}
              onClick={() => onToggleTag(name)}
            />
          ))}
        </div>
      )}

      {matchCount !== null && (
        <p className="mt-3 font-mono text-[10px] text-slate-500">
          {matchCount} shown · filters active
        </p>
      )}
    </div>
  );
}

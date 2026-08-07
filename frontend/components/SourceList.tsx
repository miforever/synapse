"use client";

import type { SourceRef } from "@/lib/types";

/**
 * The memory's citations, gathered at the foot of what it says.
 *
 * The inline numbers are for reading; this is for checking. Someone deciding
 * whether to trust a memory wants to see everything it was written from at
 * once, rather than hovering each citation in turn to find out.
 */
export function SourceList({ sources }: { sources: readonly SourceRef[] }) {
  return (
    <section className="mt-5 border-t border-white/10 pt-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
        Sources
        <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-slate-300">
          {sources.length}
        </span>
      </p>

      <ol className="mt-2 space-y-1">
        {sources.map((source) => (
          <li key={source.id}>
            <a
              href={source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex gap-2.5 rounded-lg p-2 transition hover:bg-white/5"
            >
              {/* The same number the text cites, so a reader following a
                  citation lands on the right line without counting. */}
              <span className="mt-0.5 flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/15 px-1 font-mono text-[9px] leading-none text-violet-200">
                {source.position}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs text-slate-200">
                  {source.title || source.url}
                </span>
                <span className="block truncate font-mono text-[10px] text-slate-500">
                  {source.site}
                </span>
                {source.snippet && (
                  <span className="mt-1 line-clamp-2 block text-[11px] italic leading-relaxed text-slate-500">
                    {source.snippet}
                  </span>
                )}
              </span>
            </a>
          </li>
        ))}
      </ol>
    </section>
  );
}

"use client";

import type { SourceRef } from "@/lib/types";

/** The first letter of the site, standing in for a favicon we never fetch. */
function initial(source: SourceRef): string {
  return (source.site || source.title || "?").charAt(0).toUpperCase();
}

/**
 * A citation, in the middle of the sentence it supports.
 *
 * A superscript number rather than a link with the URL in it: the claim is
 * what the reader is reading, and a bare address in the middle of it breaks
 * the line. The number is small enough to skip over and precise enough to
 * follow, which is what a citation is for.
 *
 * Hovering shows the source itself — title, site, and the line the memory was
 * written from — so checking where something came from does not cost a tab.
 */
export function SourceChip({ source }: { source: SourceRef }) {
  return (
    <span className="group relative inline-block">
      <a
        href={source.url}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`Source ${source.position}: ${source.title || source.site}`}
        className="ml-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full border border-violet-400/30 bg-violet-400/15 px-1 align-super font-mono text-[9px] leading-none text-violet-200 no-underline transition hover:border-violet-300/60 hover:bg-violet-400/30 hover:text-white"
      >
        {source.position}
      </a>

      {/*
        The preview. Left-anchored and above the line, pointer-events-none so
        it cannot come between the pointer and the citation that raised it.
      */}
      <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-1.5 hidden w-72 group-hover:block">
        <span className="glass-panel block rounded-lg p-3">
          <span className="flex items-center gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-violet-400/20 font-mono text-[10px] text-violet-200">
              {initial(source)}
            </span>
            <span className="truncate font-mono text-[10px] uppercase tracking-widest text-slate-400">
              {source.site || "source"}
            </span>
          </span>

          {source.title && (
            <span className="mt-1.5 block text-xs font-medium leading-snug text-white">
              {source.title}
            </span>
          )}

          {source.snippet && (
            // The line the memory was actually written from. Quoted, and
            // clipped: this is a reminder of the passage, not the page.
            <span className="mt-1 line-clamp-4 block border-l border-white/15 pl-2 text-[11px] italic leading-relaxed text-slate-400">
              {source.snippet}
            </span>
          )}

          <span className="mt-1.5 block truncate font-mono text-[10px] text-cyan-300/80">
            {source.url}
          </span>
        </span>
      </span>
    </span>
  );
}

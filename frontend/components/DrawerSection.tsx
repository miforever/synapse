"use client";

import type { ReactNode } from "react";

/**
 * A titled block in the memory drawer.
 *
 * The drawer stacks several of these — files, sources — and they have to read
 * as the same kind of thing, which they stop doing the moment one of them
 * grows its own idea of the spacing above its rule or the shape of its count.
 */
export function DrawerSection({
  title,
  count,
  children,
}: {
  title: string;
  /** Omitted when a bare heading says it better than "0" would. */
  count?: number;
  children: ReactNode;
}) {
  return (
    <section className="mt-5 border-t border-white/10 pt-5">
      <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
        {title}
        {count !== undefined && count > 0 && (
          <span className="ml-2 rounded-full bg-white/10 px-1.5 py-0.5 text-slate-300">
            {count}
          </span>
        )}
      </p>
      {children}
    </section>
  );
}

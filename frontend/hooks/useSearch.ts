"use client";

import { useEffect, useState } from "react";

import { searchNodes } from "@/lib/api";
import type { NodeSearchResult } from "@/lib/types";

const DEBOUNCE_MS = 180;

/**
 * Debounced search against the daemon.
 *
 * Content lives only in the database, not in the canvas snapshot, so matching
 * has to happen server-side — filtering the loaded nodes client-side would
 * silently miss anything written in the Markdown body.
 */
export function useSearch(query: string) {
  const [results, setResults] = useState<NodeSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setSearching(false);
      return;
    }

    setSearching(true);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      searchNodes(trimmed, controller.signal)
        .then(setResults)
        .catch(() => setResults([]))
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [query]);

  return { results, searching };
}

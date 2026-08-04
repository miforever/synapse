"use client";

import { useEffect, useState } from "react";

/**
 * Tracks the OS "reduce motion" preference.
 *
 * Ambient drift is decorative, so it must default off for anyone who has
 * asked their system for less movement — for some people continuous motion
 * is a vestibular trigger, not a flourish.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

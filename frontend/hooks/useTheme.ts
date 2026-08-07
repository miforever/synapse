"use client";

import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "dark" | "light" | "system";
export type Theme = "dark" | "light";

/**
 * Kept in localStorage rather than with the daemon.
 *
 * A theme belongs to the screen you are looking at, not to the graph: the same
 * store opened on a laptop at night and a monitor at noon wants two different
 * answers, and a shared setting would have one window's choice reach across
 * and change the other's.
 */
const KEY = "synapsse.theme";

function stored(): ThemePreference {
  if (typeof localStorage === "undefined") return "dark";
  const value = localStorage.getItem(KEY);
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "dark";
}

function systemTheme(): Theme {
  return typeof matchMedia !== "undefined" &&
    matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

export function resolveTheme(preference: ThemePreference): Theme {
  return preference === "system" ? systemTheme() : preference;
}

/**
 * The theme, applied to the document and remembered.
 *
 * `data-theme` on the root element, where the variables are declared, so one
 * attribute changes the interface and the graph together. Dark by default:
 * the canvas is a graph of glowing nodes, and a glow needs somewhere to glow.
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>("dark");
  const [theme, setTheme] = useState<Theme>("dark");

  const apply = useCallback((next: ThemePreference) => {
    const resolved = resolveTheme(next);
    setTheme(resolved);
    document.documentElement.dataset.theme = resolved;
  }, []);

  // Read once on mount. Rendering from localStorage directly would differ
  // between the server's HTML and the client's first paint.
  useEffect(() => {
    const initial = stored();
    setPreference(initial);
    apply(initial);
  }, [apply]);

  // Following the system means following it as it changes, not only at load.
  useEffect(() => {
    if (preference !== "system" || typeof matchMedia === "undefined") return;

    const query = matchMedia("(prefers-color-scheme: light)");
    const onChange = () => apply("system");
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, [preference, apply]);

  const choose = useCallback(
    (next: ThemePreference) => {
      setPreference(next);
      apply(next);
      try {
        localStorage.setItem(KEY, next);
      } catch {
        // Storage denied. The theme holds for this session and is forgotten
        // on the next, which is better than refusing to change it at all.
      }
    },
    [apply],
  );

  return { preference, theme, choose };
}

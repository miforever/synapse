"use client";

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { useSettings } from "@/hooks/useSettings";
import { useGraphStore } from "./GraphProvider";
import { SettingsPanel } from "./SettingsPanel";

/**
 * The two things you can be looking at, and the ways each can be drawn.
 *
 * Both sections have sub-modes, and both are routes. Before this the canvas's
 * 2D/3D sat at the top level while the roadmap's Path/Board sat under a
 * section — so the same kind of choice appeared at two different depths, and
 * only one of them was in the URL.
 */
const SECTIONS = [
  {
    slug: "canvas",
    label: "Canvas",
    modes: [
      { slug: "2d", label: "2D" },
      { slug: "3d", label: "3D" },
    ],
  },
  {
    slug: "roadmap",
    label: "Roadmap",
    modes: [
      { slug: "path", label: "Path" },
      { slug: "board", label: "Board" },
    ],
  },
] as const;

export type Section = (typeof SECTIONS)[number]["slug"];

/** Where a section goes when it is picked: whichever mode was last open. */
const DEFAULT_MODE: Record<Section, string> = {
  canvas: "3d",
  roadmap: "path",
};

export function AppBar() {
  const pathname = usePathname();
  const { settings, updateMedia } = useSettings();
  const {
    data,
    connected,
    // Renamed on the way in: `motion` is framer's namespace in this file.
    motion: driftOn,
    setMotion,
    reducedMotion,
    resetLayout,
  } = useGraphStore();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  const [, section = "canvas", mode = ""] = pathname.split("/");
  const current = SECTIONS.find((item) => item.slug === section) ?? SECTIONS[0];

  // Each section counts what it is about: the canvas counts memories, the
  // roadmap counts the ones that are work.
  const onRoadmap = current.slug === "roadmap";
  const count = onRoadmap
    ? data.nodes.filter((node) => node.status).length
    : data.nodes.length;
  const countLabel = onRoadmap
    ? count === 1
      ? "item"
      : "items"
    : count === 1
      ? "memory"
      : "memories";

  /*
   * The mode you were last on, per section.
   *
   * Switching to the roadmap and back should return the canvas to 3D if that
   * is where you left it, rather than to whichever mode happens to be first
   * in the list.
   */
  const lastMode = useRef<Record<string, string>>({ ...DEFAULT_MODE });
  useEffect(() => {
    if (mode) lastMode.current[section] = mode;
  }, [section, mode]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      {/*
        Three anchors that never move or resize: the brand top-left, the
        navigation top-centre, the state of the graph bottom-left. Search owns
        the top-right and the drawer owns the right edge, so nothing here can
        ever grow into something else.
      */}
      <div className="pointer-events-none absolute left-5 top-5 z-30 flex items-center gap-2.5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/synapsse-mark.svg"
          alt=""
          width={24}
          height={24}
          className="shrink-0"
        />
        <span className="text-sm font-semibold tracking-tight text-white">
          Synapsse
        </span>
      </div>

      {/*
        One row, and it moves rather than jumps.

        Stacked, the section and its modes made a tall box that read as a
        dialog left open in the middle of the canvas. On one line they read as
        a path — this section, drawn this way — and the pill grows or shrinks
        to fit whichever modes belong to the section you picked.

        Centred by a flex wrapper rather than a translate: a layout animation
        writes the element's transform, so a translate of our own would be
        overwritten mid-flight and the pill would slide off centre as it
        resized.
      */}
      <div className="pointer-events-none absolute inset-x-0 top-5 z-30 flex justify-center">
        <motion.div
          layout
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
          className="glass-panel pointer-events-auto flex items-center gap-1 rounded-full px-1.5 py-1"
        >
          <nav className="flex items-center">
            {SECTIONS.map((item) => {
              const active = item.slug === current.slug;
              return (
                <Link
                  key={item.slug}
                  href={`/${item.slug}/${
                    lastMode.current[item.slug] ?? DEFAULT_MODE[item.slug]
                  }`}
                  aria-current={active ? "page" : undefined}
                  className={`relative rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                    active ? "text-white" : "text-slate-500 hover:text-slate-300"
                  }`}
                >
                  {/*
                    One element shared between the two, so the highlight
                    travels from the section you left to the one you picked
                    instead of blinking out and in.
                  */}
                  {active && (
                    <motion.span
                      layoutId="section-highlight"
                      transition={{ type: "spring", stiffness: 420, damping: 34 }}
                      className="absolute inset-0 rounded-full bg-white/10"
                    />
                  )}
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <motion.span layout className="mx-0.5 h-4 w-px bg-white/10" />

          {/*
            The modes belong to the section, so they leave with it. popLayout
            takes the outgoing ones out of the flow as they fade, which is what
            lets the pill resize smoothly rather than after they have gone.
          */}
          <AnimatePresence mode="popLayout" initial={false}>
            {current.modes.map((item) => {
              const active = item.slug === mode;
              return (
                <motion.div
                  key={`${current.slug}-${item.slug}`}
                  layout
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ type: "spring", stiffness: 420, damping: 34 }}
                >
                  <Link
                    href={`/${current.slug}/${item.slug}`}
                    aria-current={active ? "true" : undefined}
                    className={`relative block rounded-full px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition-colors ${
                      active ? "text-cyan" : "text-slate-500 hover:text-slate-300"
                    }`}
                  >
                    {active && (
                      <motion.span
                        layoutId="mode-highlight"
                        transition={{
                          type: "spring",
                          stiffness: 420,
                          damping: 34,
                        }}
                        className="absolute inset-0 rounded-full bg-cyan/15"
                      />
                    )}
                    <span className="relative">{item.label}</span>
                  </Link>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      </div>

      <div
        ref={container}
        className="glass-panel absolute bottom-5 left-5 z-30 rounded-xl px-3 py-2"
      >
        {/* Opens upward, since this sits at the foot of the window. */}
        <SettingsPanel
          open={open}
          above
          onClose={() => setOpen(false)}
          media={settings.media}
          onMediaChange={updateMedia}
          motion={driftOn}
          onMotionChange={setMotion}
          reducedMotion={reducedMotion}
          onResetLayout={resetLayout}
        />

        <div className="flex items-center gap-2.5">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              connected ? "bg-emerald-400" : "bg-slate-600"
            }`}
            title={connected ? "Live" : "Reconnecting…"}
          />
          <span
            data-testid="memory-count"
            className="font-mono text-xs tabular-nums text-slate-300"
          >
            {count}
          </span>
          {/* The label changes with the section: the two counts are not the
              same thing, and a bare number would read as the graph shrinking
              on the way to the roadmap. */}
          <span className="text-[11px] text-slate-500">{countLabel}</span>

          <span className="mx-0.5 h-4 w-px bg-white/10" />

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-label="Settings"
            title="Settings"
            className={`rounded-lg px-2 py-1.5 text-base leading-none transition ${
              open
                ? "bg-white/10 text-white"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            <span
              className={`inline-block transition-transform duration-200 ${
                open ? "rotate-90" : ""
              }`}
            >
              ⚙
            </span>
          </button>
        </div>
      </div>
    </>
  );
}

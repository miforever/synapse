"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { CanvasMode } from "./GraphCanvas";
import { SettingsPanel } from "./SettingsPanel";
import type { MediaSettings } from "@/lib/types";

interface Props {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  connected: boolean;
  nodeCount: number;
  media: MediaSettings;
  onMediaChange: (media: Partial<MediaSettings>) => void;
  motion: boolean;
  onMotionChange: (motion: boolean) => void;
  reducedMotion: boolean;
  onResetLayout: () => void;
}

const MODES: CanvasMode[] = ["2d", "3d"];

/**
 * Only what you reach for while navigating: identity, scale, and view mode.
 * The preferences unfold from the bottom of this same panel, so the settings
 * are visibly part of the bar rather than a window floating over the canvas.
 */
export function ControlBar({
  mode,
  onModeChange,
  connected,
  nodeCount,
  media,
  onMediaChange,
  motion,
  onMotionChange,
  reducedMotion,
  onResetLayout,
}: Props) {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

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
    <div
      ref={container}
      className="glass-panel absolute left-5 top-5 z-20 rounded-2xl px-4 py-3"
    >
      <div className="flex items-center gap-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/branding/synapse-mark.svg"
          alt="SYNAPSE"
          width={26}
          height={26}
          className="shrink-0"
        />

        <span
          className="flex items-center gap-2"
          title={connected ? "Live" : "Reconnecting…"}
        >
          <span
            className={`h-2 w-2 rounded-full ${
              connected ? "bg-emerald-400" : "bg-slate-600"
            }`}
          />
          <span
            data-testid="memory-count"
            className="text-sm font-medium tabular-nums text-slate-200"
          >
            {nodeCount}
          </span>
          <span className="text-xs text-slate-500">
            {nodeCount === 1 ? "memory" : "memories"}
          </span>
        </span>

        <span className="h-5 w-px bg-white/10" />

        {/* Segmented control: the two modes read as one choice, not two buttons. */}
        <div className="flex rounded-md bg-black/30 p-0.5">
          {MODES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => onModeChange(value)}
              aria-pressed={mode === value}
              className={`rounded-md px-3 py-1.5 font-mono text-[11px] uppercase tracking-widest transition ${
                mode === value
                  ? "bg-cyan/15 text-cyan"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        <span className="h-5 w-px bg-white/10" />

        {/* The same memories, seen as work. */}
        <Link
          href="/roadmap"
          title="Roadmap"
          className="rounded-md px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-widest text-slate-500 transition hover:bg-white/5 hover:text-slate-300"
        >
          Roadmap
        </Link>

        <span className="h-5 w-px bg-white/10" />

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-label="Settings"
          title="Settings"
          className={`rounded-md px-2.5 py-1.5 text-base leading-none transition ${
            open ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
          }`}
        >
          {/* Turns with the panel, so the button reads as the handle that
              opened it rather than as a toggle that happens to be lit. */}
          <span
            className={`inline-block transition-transform duration-200 ${
              open ? "rotate-90" : ""
            }`}
          >
            ⚙
          </span>
        </button>
      </div>

      <SettingsPanel
        open={open}
        onClose={() => setOpen(false)}
        media={media}
        onMediaChange={onMediaChange}
        motion={motion}
        onMotionChange={onMotionChange}
        reducedMotion={reducedMotion}
        onResetLayout={onResetLayout}
      />
    </div>
  );
}

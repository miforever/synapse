"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";

import type { MediaSettings } from "@/lib/types";

interface Props {
  media: MediaSettings;
  onMediaChange: (media: Partial<MediaSettings>) => void;
  motion: boolean;
  onMotionChange: (motion: boolean) => void;
  reducedMotion: boolean;
}

function Switch({
  label,
  hint,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  hint: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span
        className={`mt-0.5 flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition ${
          checked ? "bg-cyan/70" : "bg-white/15"
        }`}
      >
        <span
          className={`h-3 w-3 rounded-full bg-white transition-transform ${
            checked ? "translate-x-3" : ""
          }`}
        />
      </span>
      <span className="min-w-0">
        <span className="block text-xs text-slate-200">{label}</span>
        <span className="block text-[10px] leading-snug text-slate-500">
          {hint}
        </span>
      </span>
    </button>
  );
}

/**
 * Secondary controls, behind one button.
 *
 * These are preferences rather than things you reach for while navigating, and
 * as bare toggles labelled "img / audio / video / remote" they were both
 * cryptic and competing with the view mode for attention. A menu gives each
 * one room to say what it actually does.
 */
export function SettingsMenu({
  media,
  onMediaChange,
  motion: motionOn,
  onMotionChange,
  reducedMotion,
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
    <div ref={container} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Settings"
        title="Settings"
        className={`rounded-md px-2 py-1 text-xs transition ${
          open ? "bg-white/10 text-white" : "text-slate-500 hover:text-slate-300"
        }`}
      >
        ⚙
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="glass-panel absolute left-0 top-full z-30 mt-2 w-72 rounded-xl p-2"
          >
            <p className="px-2 pb-1 pt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Canvas
            </p>
            <Switch
              label="Ambient drift"
              hint={
                reducedMotion
                  ? "Disabled — your system asks for reduced motion"
                  : "Nodes breathe slowly in place"
              }
              checked={motionOn}
              disabled={reducedMotion}
              onChange={onMotionChange}
            />

            <p className="mt-2 px-2 pb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Media in memories
            </p>
            <Switch
              label="Images"
              hint="Render pictures inside memory content"
              checked={media.images}
              onChange={(images) => onMediaChange({ images })}
            />
            <Switch
              label="Audio"
              hint="Show a player instead of a link"
              checked={media.audio}
              onChange={(audio) => onMediaChange({ audio })}
            />
            <Switch
              label="Video"
              hint="Show a player instead of a link"
              checked={media.video}
              onChange={(video) => onMediaChange({ video })}
            />
            <Switch
              label="Remote sources"
              hint="Allow loading from other sites. Memories are written by agents, so this stays off until you allow it."
              checked={media.remote_sources}
              onChange={(remote_sources) => onMediaChange({ remote_sources })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

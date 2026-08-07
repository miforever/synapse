"use client";

import { AnimatePresence, motion } from "framer-motion";
import type { MediaSettings } from "@/lib/types";

interface Props {
  open: boolean;
  media: MediaSettings;
  onMediaChange: (media: Partial<MediaSettings>) => void;
  motion: boolean;
  onMotionChange: (motion: boolean) => void;
  reducedMotion: boolean;
  onResetLayout: () => void;
  onClose: () => void;
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
 * Secondary controls, unfolding from the bar they belong to.
 *
 * Not a popover any more: as a floating card it read as a separate window that
 * happened to appear near the bar, and it covered the canvas underneath it.
 * Growing the bar's own body downward keeps one object on screen — the panel
 * you were already looking at, with more of itself showing.
 *
 * Open state is owned by the bar rather than by this component, since the bar
 * is what changes shape.
 */
export function SettingsPanel({
  open,
  media,
  onMediaChange,
  motion: motionOn,
  onMotionChange,
  reducedMotion,
  onResetLayout,
  onClose,
}: Props) {
  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          // Height and opacity together: height alone slides the content into
          // view like a drawer of text, and the fade is what makes it read as
          // the panel deepening instead.
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="mt-3 w-72 border-t border-white/10 pt-2">
            <p className="px-2 pb-1 pt-1 font-mono text-[9px] uppercase tracking-[0.2em] text-slate-600">
              Canvas
            </p>
            <Switch
              label="Ambient drift"
              hint={
                reducedMotion
                  ? "Disabled — your system asks for reduced motion"
                  : "Nodes breathe in place, and the 3D scene turns slowly"
              }
              checked={motionOn}
              disabled={reducedMotion}
              onChange={onMotionChange}
            />

            {/*
              Dragging a memory pins it, and pins now outlive the session — so
              there has to be a way back. Without this the only route to an
              automatic layout again would be editing the database.
            */}
            <button
              type="button"
              onClick={() => {
                onResetLayout();
                onClose();
              }}
              className="flex w-full items-start gap-3 rounded-lg px-2 py-2 text-left transition hover:bg-white/5"
            >
              <span className="mt-0.5 flex h-4 w-7 shrink-0 items-center justify-center text-slate-500">
                ↺
              </span>
              <span className="min-w-0">
                <span className="block text-xs text-slate-200">
                  Reset arrangement
                </span>
                <span className="block text-[10px] leading-snug text-slate-500">
                  Release every memory you placed by hand and lay the graph out
                  afresh
                </span>
              </span>
            </button>

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
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

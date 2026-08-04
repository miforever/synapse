"use client";

import type { CanvasMode } from "./GraphCanvas";
import { SettingsMenu } from "./SettingsMenu";
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
}

const MODES: CanvasMode[] = ["2d", "3d"];

/**
 * Only what you reach for while navigating: identity, scale, and view mode.
 * Everything else lives behind the settings button.
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
}: Props) {
  return (
    <div className="glass-panel absolute left-5 top-5 z-20 flex items-center gap-3 rounded-xl px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/synapse-mark.svg"
        alt="SYNAPSE"
        width={20}
        height={20}
        className="shrink-0"
      />

      <span className="flex items-center gap-1.5" title={connected ? "Live" : "Reconnecting…"}>
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? "bg-emerald-400" : "bg-slate-600"
          }`}
        />
        <span
          data-testid="memory-count"
          className="text-xs tabular-nums text-slate-300"
        >
          {nodeCount}
        </span>
        <span className="text-[10px] text-slate-500">
          {nodeCount === 1 ? "memory" : "memories"}
        </span>
      </span>

      <span className="h-4 w-px bg-white/10" />

      {/* Segmented control: the two modes read as one choice, not two buttons. */}
      <div className="flex rounded-md bg-black/30 p-0.5">
        {MODES.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            aria-pressed={mode === value}
            className={`rounded px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
              mode === value
                ? "bg-cyan/15 text-cyan"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <span className="h-4 w-px bg-white/10" />

      <SettingsMenu
        media={media}
        onMediaChange={onMediaChange}
        motion={motion}
        onMotionChange={onMotionChange}
        reducedMotion={reducedMotion}
      />
    </div>
  );
}

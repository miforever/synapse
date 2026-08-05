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
  onResetLayout: () => void;
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
  onResetLayout,
}: Props) {
  return (
    <div className="glass-panel absolute left-5 top-5 z-20 flex items-center gap-4 rounded-2xl px-4 py-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/synapse-mark.svg"
        alt="SYNAPSE"
        width={26}
        height={26}
        className="shrink-0"
      />

      <span className="flex items-center gap-2" title={connected ? "Live" : "Reconnecting…"}>
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

      <SettingsMenu
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

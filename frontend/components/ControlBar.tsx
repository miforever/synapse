"use client";

import type { CanvasMode } from "./GraphCanvas";
import type { MediaSettings } from "@/lib/types";

interface Props {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  connected: boolean;
  nodeCount: number;
  media: MediaSettings;
  onMediaChange: (media: Partial<MediaSettings>) => void;
}

const MEDIA_SWITCHES: { key: keyof MediaSettings; label: string }[] = [
  { key: "images", label: "img" },
  { key: "audio", label: "audio" },
  { key: "video", label: "video" },
  { key: "remote_sources", label: "remote" },
];

export function ControlBar({
  mode,
  onModeChange,
  connected,
  nodeCount,
  media,
  onMediaChange,
}: Props) {
  return (
    <div className="glass-panel absolute left-5 top-5 z-20 flex items-center gap-4 rounded-xl px-4 py-2.5">
      {/* Mark only here — the wordmark would crowd the control strip. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/branding/synapse-mark.svg" alt="SYNAPSE" width={22} height={22} />

      <div className="h-4 w-px bg-white/10" />

      <div className="flex items-center gap-2">
        <span
          className={`h-1.5 w-1.5 rounded-full ${
            connected ? "bg-emerald-400" : "bg-slate-600"
          }`}
          title={connected ? "Live" : "Disconnected"}
        />
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-400">
          {nodeCount} node{nodeCount === 1 ? "" : "s"}
        </span>
      </div>

      <div className="h-4 w-px bg-white/10" />

      <div className="flex gap-1">
        {(["2d", "3d"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onModeChange(value)}
            className={`rounded-md px-2.5 py-1 font-mono text-[10px] uppercase tracking-widest transition ${
              mode === value
                ? "bg-cyan-400/15 text-cyan-300"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {value}
          </button>
        ))}
      </div>

      <div className="h-4 w-px bg-white/10" />

      <div className="flex gap-1">
        {MEDIA_SWITCHES.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onMediaChange({ [key]: !media[key] })}
            title={`Toggle ${key.replace("_", " ")} in memory content`}
            className={`rounded-md px-2 py-1 font-mono text-[10px] transition ${
              media[key]
                ? "bg-white/10 text-slate-200"
                : "text-slate-600 hover:text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";

import { Logo } from "./Logo";

const MCP_COMMAND = "claude mcp add --transport http synapse http://localhost:8000/mcp";

function CopyableCommand({ command }: { command: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(command).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1600);
        });
      }}
      title="Copy to clipboard"
      className="group mt-3 flex w-full items-center gap-2 rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-left transition hover:border-cyan/30"
    >
      <code className="min-w-0 flex-1 truncate font-mono text-[10px] text-cyan">
        {command}
      </code>
      <span className="shrink-0 font-mono text-[9px] uppercase tracking-widest text-slate-500 group-hover:text-slate-300">
        {copied ? "copied" : "copy"}
      </span>
    </button>
  );
}

/**
 * Covers every state before there is a graph to look at.
 *
 * An empty canvas with no explanation is the worst possible first run, so this
 * distinguishes "still loading" from "daemon unreachable" from "connected but
 * empty" — and in the last case says exactly how to connect an agent.
 */
export function StatusOverlay({
  loading,
  error,
  empty,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  empty: boolean;
  onRetry: () => void;
}) {
  if (!loading && !error && !empty) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="glass-panel pointer-events-auto w-full max-w-md rounded-xl p-8">
        <Logo size={40} />

        {loading && (
          <p className="mt-6 flex items-center gap-2 font-mono text-[11px] text-slate-400">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan" />
            Loading the graph…
          </p>
        )}

        {!loading && error && (
          <>
            <p className="mt-6 text-sm text-slate-300">
              Cannot reach the daemon.
            </p>
            <p className="mt-1 font-mono text-[10px] text-slate-500">{error}</p>
            <p className="mt-3 text-xs text-slate-400">
              Start it with{" "}
              <code className="font-mono text-cyan">
                uv run uvicorn app.main:app
              </code>{" "}
              from <code className="font-mono text-slate-300">backend/</code>,
              or bring up the Docker stack.
            </p>
            <button
              type="button"
              onClick={onRetry}
              className="mt-4 rounded-lg border border-white/15 px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-slate-300 transition hover:border-cyan/40 hover:text-white"
            >
              Retry
            </button>
          </>
        )}

        {!loading && !error && empty && (
          <>
            <p className="mt-6 text-sm text-slate-300">
              Connected, with no memories yet.
            </p>
            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              Point an agent at the daemon, then ask it to remember something.
              Nodes appear here as they are written — no refresh.
            </p>
            <CopyableCommand command={MCP_COMMAND} />
            <p className="mt-2 font-mono text-[10px] text-slate-600">
              Cursor: add the same URL to ~/.cursor/mcp.json
            </p>
          </>
        )}
      </div>
    </div>
  );
}

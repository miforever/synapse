export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="glass-panel max-w-md rounded-lg p-8 text-center">
        <h1 className="text-2xl font-bold tracking-wide text-white">SYNAPSE</h1>
        <p className="mt-2 font-mono text-xs uppercase tracking-[0.25em] text-slate-400">
          Memory Graph Daemon
        </p>
        <p className="mt-6 text-sm text-slate-300">
          2D/3D canvas, hover cards, and the slide-out markdown drawer land in
          Phase 3. This placeholder confirms the frontend shell, dark theme,
          and branding icon are wired up.
        </p>
      </div>
    </main>
  );
}

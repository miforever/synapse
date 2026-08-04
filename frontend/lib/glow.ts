/**
 * The soft radial disc used for nodes, shared by both renderers.
 *
 * 3D wraps it in a texture; 2D blits it straight onto the canvas. Keeping one
 * source means a node looks like the same object in either view, and 2D stops
 * reading as flat vector circles next to the lit 3D sprites.
 *
 * Cached per colour — building a gradient per node per frame would be the
 * single most expensive thing in the 2D paint path.
 */

const cache = new Map<string, HTMLCanvasElement>();

export const GLOW_SIZE = 128;

export function glowCanvas(color: string): HTMLCanvasElement | null {
  const cached = cache.get(color);
  if (cached) return cached;

  if (typeof document === "undefined") return null;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = GLOW_SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const half = GLOW_SIZE / 2;
  const gradient = ctx.createRadialGradient(half, half, 0, half, half, half);
  // A bright core that holds its colour, then a long falloff so nodes bloom
  // into the background rather than ending on a hard edge.
  gradient.addColorStop(0, color);
  gradient.addColorStop(0.25, color);
  gradient.addColorStop(0.5, `${color}66`);
  gradient.addColorStop(1, "rgba(0,0,0,0)");

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(half, half, half, 0, Math.PI * 2);
  ctx.fill();

  cache.set(color, canvas);
  return canvas;
}

export function clearGlowCache(): void {
  cache.clear();
}

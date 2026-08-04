/**
 * Shared thumbnail loader for both renderers.
 *
 * Images are fetched once per URL and reused across every node that
 * references them. Loads are fire-and-forget: callers get whatever is ready
 * now and are notified once, so a slow image never blocks a frame.
 */

type Status = "loading" | "ready" | "failed";

interface Entry {
  status: Status;
  image?: HTMLImageElement;
  /** Circular-masked copies, keyed by ring colour and size. */
  masked: Map<string, HTMLCanvasElement>;
}

const cache = new Map<string, Entry>();

/**
 * Returns the image if it is already decoded, otherwise starts loading and
 * returns null. `onReady` fires once when a pending load completes.
 */
export function getImage(
  url: string,
  onReady?: () => void,
): HTMLImageElement | null {
  const existing = cache.get(url);
  if (existing) {
    return existing.status === "ready" ? (existing.image ?? null) : null;
  }

  const entry: Entry = { status: "loading", masked: new Map() };
  cache.set(url, entry);

  const image = new Image();
  // Needed so the decoded pixels can be drawn into a canvas and used as a
  // WebGL texture without tainting it.
  image.crossOrigin = "anonymous";

  image.onload = () => {
    entry.status = "ready";
    entry.image = image;
    onReady?.();
  };
  image.onerror = () => {
    entry.status = "failed";
    onReady?.();
  };
  image.src = url;

  return null;
}

/**
 * A circular crop of the thumbnail with a ring in the node's class colour.
 * Cached, since masking is pure canvas work repeated every frame otherwise.
 */
export function getCircularThumbnail(
  url: string,
  ringColor: string,
  size: number,
  onReady?: () => void,
): HTMLCanvasElement | null {
  const image = getImage(url, onReady);
  if (!image) return null;

  const entry = cache.get(url);
  if (!entry) return null;

  const key = `${ringColor}@${size}`;
  const cached = entry.masked.get(key);
  if (cached) return cached;

  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  const half = size / 2;

  ctx.save();
  ctx.beginPath();
  ctx.arc(half, half, half - 2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();

  // Cover-fit: crop the long edge rather than distorting the image.
  const scale = Math.max(size / image.width, size / image.height);
  const width = image.width * scale;
  const height = image.height * scale;
  ctx.drawImage(image, half - width / 2, half - height / 2, width, height);
  ctx.restore();

  ctx.beginPath();
  ctx.arc(half, half, half - 1.5, 0, Math.PI * 2);
  ctx.strokeStyle = ringColor;
  ctx.lineWidth = 3;
  ctx.stroke();

  entry.masked.set(key, canvas);
  return canvas;
}

export function hasFailed(url: string): boolean {
  return cache.get(url)?.status === "failed";
}

export function clearImageCache(): void {
  cache.clear();
}

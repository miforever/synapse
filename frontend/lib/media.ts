/**
 * Classifies media referenced inside memory content.
 *
 * Markdown has no audio or video syntax, so `![label](clip.mp3)` is the
 * conventional way to embed them. Rather than rendering that as a broken
 * image, the drawer classifies the URL and picks the right player.
 */

export type MediaKind = "image" | "audio" | "video" | "other";

const EXTENSIONS: Record<Exclude<MediaKind, "other">, readonly string[]> = {
  image: ["png", "jpg", "jpeg", "gif", "webp", "avif", "svg", "bmp"],
  audio: ["mp3", "wav", "ogg", "oga", "m4a", "aac", "flac", "opus"],
  video: ["mp4", "webm", "mov", "m4v", "ogv"],
};

export function mediaKind(url: string): MediaKind {
  // Strip query and hash before reading the extension.
  const path = url.split(/[?#]/, 1)[0] ?? "";
  const extension = path.split(".").pop()?.toLowerCase();
  if (!extension || extension === path) return "other";

  for (const [kind, list] of Object.entries(EXTENSIONS)) {
    if (list.includes(extension)) return kind as MediaKind;
  }
  return "other";
}

/** Data and blob URLs are inert; anything else opens in a new tab. */
export function isExternal(url: string): boolean {
  return /^https?:\/\//i.test(url);
}

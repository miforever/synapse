/**
 * What a file is, in the terms the drawer talks about it.
 *
 * Kept out of the components that render them: the drawer, the inline chip and
 * the list all ask the same three questions of an attachment, and having them
 * import the answers from each other is how one of them ends up with its own
 * slightly different idea of what counts as an image.
 */

import type { FileRef } from "./types";

/** Bytes, in the shortest form that is still honest about the size. */
export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;

  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  // One decimal only while it earns its place: 1.4 MB says something 1 MB
  // does not, where 148.3 MB is just noise.
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function isImage(file: FileRef): boolean {
  return file.media_type.startsWith("image/");
}

/** A short label for the kind of thing this is. */
export function kindOf(file: FileRef): string {
  const [family, specific = ""] = file.media_type.split("/");
  if (family === "image" || family === "audio" || family === "video") {
    return family;
  }
  if (specific.includes("pdf")) return "pdf";

  // Falling back to the extension, which is what the reader would call it
  // anyway when the media type is the unhelpful octet-stream default.
  const extension = file.name.split(".").pop();
  return extension && extension !== file.name ? extension.toLowerCase() : "file";
}

"use client";

import { fileUrl } from "@/lib/api";
import type { FileRef } from "@/lib/types";

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
  return `${value < 10 ? value.toFixed(1) : Math.round(value)} ${units[unit]}`;
}

export function isImage(file: FileRef): boolean {
  return file.media_type.startsWith("image/");
}

/** A rough label for the kind of thing this is, from its media type. */
export function kindOf(file: FileRef): string {
  const [family, specific = ""] = file.media_type.split("/");
  if (family === "image" || family === "audio" || family === "video") {
    return family;
  }
  if (specific.includes("pdf")) return "pdf";
  const extension = file.name.split(".").pop();
  return extension && extension !== file.name ? extension.toLowerCase() : "file";
}

/**
 * A file mentioned in the middle of a memory's text.
 *
 * Sits inline like a word rather than breaking the paragraph, because that is
 * where the agent put it — "the numbers in [[file:q3.xlsx]] disagree" reads as
 * a sentence, and a full-width attachment card in the middle of it would not.
 *
 * Hovering shows what it is before you commit to opening it: images preview
 * themselves, everything else states its kind and size.
 */
export function FileChip({ file }: { file: FileRef }) {
  const href = fileUrl(file);

  return (
    <span className="group relative inline-block align-baseline">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-baseline gap-1 rounded-md border border-cyan/20 bg-cyan/10 px-1.5 py-0.5 align-baseline text-[0.9em] text-cyan-200 no-underline transition hover:border-cyan/50 hover:bg-cyan/20 hover:text-white"
      >
        <span aria-hidden className="font-mono text-[0.85em] opacity-70">
          ↗
        </span>
        {file.name}
      </a>

      {/*
        Preview on hover. pointer-events-none so it can never sit between the
        pointer and the chip that summoned it, and hidden until hover rather
        than merely transparent so it is not read out to a screen reader as
        content that is there.
      */}
      <span className="pointer-events-none absolute bottom-full left-0 z-40 mb-1.5 hidden w-max max-w-[16rem] group-hover:block">
        <span className="glass-panel block rounded-lg p-2">
          {isImage(file) && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={href}
              alt=""
              loading="lazy"
              className="mb-1.5 max-h-40 max-w-full rounded"
            />
          )}
          <span className="block truncate font-mono text-[10px] text-slate-300">
            {file.name}
          </span>
          <span className="block font-mono text-[10px] uppercase tracking-widest text-slate-500">
            {kindOf(file)} · {formatSize(file.size)}
          </span>
        </span>
      </span>
    </span>
  );
}

/**
 * `[[file:NAME]]` and `[[src:N]]` in a memory's text, resolved against what
 * the memory carries.
 *
 * A mention is written by name rather than by id because an agent writing a
 * memory knows what it called the file, not the uuid the daemon will give it —
 * and a body full of uuids is unreadable to the person who opens it later.
 *
 * Resolution happens before Markdown parsing, by rewriting each mention into
 * an ordinary link with a scheme of our own. That keeps the renderer's own
 * escaping intact: nothing here injects HTML, it only produces link syntax
 * that react-markdown then handles like any other.
 */

import type { FileRef, SourceRef } from "./types";

/** The schemes a resolved mention carries, recognised by the renderer. */
export const FILE_SCHEME = "synapsse-file:";
export const SOURCE_SCHEME = "synapsse-source:";

const MENTION = /\[\[file:([^\]]+)\]\]/g;

/*
 * Citations are written by number rather than by name.
 *
 * That is how a citation reads — "as reported[[src:2]]" — and it is also the
 * only handle an agent has while it is still writing: the memory's sources are
 * cited in order, so their numbers are known before their ids exist.
 */
const CITATION = /\[\[src:(\d+)\]\]/g;

/** Markdown link text has to survive the round trip through the parser. */
function escapeLabel(name: string): string {
  return name.replace(/([[\]()\\])/g, "\\$1");
}

/**
 * Rewrite every mention that matches an attachment.
 *
 * Case-insensitive on the name, since a mention is typed by hand often enough
 * that matching exactly would make the feature feel broken. Mentions with no
 * matching attachment are left exactly as written — showing the reader that a
 * file was meant to be here is more use than silently dropping the reference.
 */
export function resolveFileMentions(
  content: string,
  files: readonly FileRef[],
): string {
  if (files.length === 0 || !content.includes("[[file:")) return content;

  const byName = new Map(files.map((file) => [file.name.toLowerCase(), file]));

  return content.replace(MENTION, (whole, rawName: string) => {
    const file = byName.get(rawName.trim().toLowerCase());
    if (!file) return whole;
    return `[${escapeLabel(file.name)}](${FILE_SCHEME}${file.id})`;
  });
}

/**
 * Rewrite every citation that matches one of the memory's sources.
 *
 * Same rule as the mentions above: a number with no source behind it stays as
 * it was written. A citation pointing at nothing is a fact about the memory
 * worth seeing, not a blemish worth hiding.
 */
export function resolveCitations(
  content: string,
  sources: readonly SourceRef[],
): string {
  if (sources.length === 0 || !content.includes("[[src:")) return content;

  const byPosition = new Map(
    sources.map((source) => [source.position, source]),
  );

  return content.replace(CITATION, (whole, rawPosition: string) => {
    const source = byPosition.get(Number(rawPosition));
    if (!source) return whole;
    return `[${source.position}](${SOURCE_SCHEME}${source.id})`;
  });
}

/** Everything a memory's text refers to, resolved in one pass. */
export function resolveReferences(
  content: string,
  files: readonly FileRef[],
  sources: readonly SourceRef[],
): string {
  return resolveCitations(resolveFileMentions(content, files), sources);
}

/** The source a resolved citation points at, if it is one of ours. */
export function citedSource(
  href: string | undefined,
  sources: readonly SourceRef[],
): SourceRef | null {
  if (!href?.startsWith(SOURCE_SCHEME)) return null;
  const id = href.slice(SOURCE_SCHEME.length);
  return sources.find((source) => source.id === id) ?? null;
}

/** The attachment a resolved link points at, if it is one of ours. */
export function mentionedFile(
  href: string | undefined,
  files: readonly FileRef[],
): FileRef | null {
  if (!href?.startsWith(FILE_SCHEME)) return null;
  const id = href.slice(FILE_SCHEME.length);
  return files.find((file) => file.id === id) ?? null;
}

"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { isExternal, mediaKind } from "@/lib/media";
import type { MediaSettings } from "@/lib/types";

interface Props {
  content: string;
  media: MediaSettings;
}

/** Shown in place of media the user has not enabled. */
function Placeholder({
  label,
  href,
  onLoad,
}: {
  label: string;
  href: string;
  onLoad?: () => void;
}) {
  return (
    <span className="my-2 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 px-3 py-2">
      <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400">
        {label}
      </span>
      {onLoad ? (
        <button
          type="button"
          onClick={onLoad}
          className="font-mono text-[10px] text-cyan-300 underline-offset-2 hover:underline"
        >
          load
        </button>
      ) : (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate font-mono text-[10px] text-cyan-300 underline-offset-2 hover:underline"
        >
          {href}
        </a>
      )}
    </span>
  );
}

/** Click-to-load wrapper, so opening a memory never auto-fetches media. */
function Deferred({
  label,
  src,
  render,
}: {
  label: string;
  src: string;
  render: () => React.ReactNode;
}) {
  const [loaded, setLoaded] = useState(false);
  if (loaded) return <>{render()}</>;
  return <Placeholder label={label} href={src} onLoad={() => setLoaded(true)} />;
}

/**
 * Renders agent-authored Markdown.
 *
 * remark-gfm turns bare URLs into links, so a pasted address is clickable
 * without link syntax. Raw HTML is never enabled — this content is written by
 * agents, and react-markdown escaping it is what keeps that safe.
 */
export function MemoryContent({ content, media }: Props) {
  const allowSource = (src: string) => media.remote_sources || !isExternal(src);

  return (
    <div className="prose-synapse text-sm leading-relaxed text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-300 underline decoration-cyan-300/30 underline-offset-2 hover:decoration-cyan-300"
            >
              {children}
            </a>
          ),

          // Markdown has no audio/video syntax, so ![](clip.mp3) arrives here
          // too. Route each URL to the right player instead of a broken image.
          img: ({ src, alt }) => {
            const url = typeof src === "string" ? src : "";
            if (!url) return null;

            const kind = mediaKind(url);
            const label = alt || kind;

            if (!allowSource(url)) {
              return <Placeholder label={`${kind} · remote`} href={url} />;
            }

            if (kind === "audio") {
              if (!media.audio) return <Placeholder label="audio" href={url} />;
              return (
                <Deferred
                  label="audio"
                  src={url}
                  render={() => (
                    <audio controls preload="none" src={url} className="my-2 w-full">
                      {label}
                    </audio>
                  )}
                />
              );
            }

            if (kind === "video") {
              if (!media.video) return <Placeholder label="video" href={url} />;
              return (
                <Deferred
                  label="video"
                  src={url}
                  render={() => (
                    <video
                      controls
                      preload="none"
                      src={url}
                      className="my-2 w-full rounded-lg"
                    />
                  )}
                />
              );
            }

            if (!media.images) return <Placeholder label="image" href={url} />;

            // next/image is not usable here: memory content can reference any
            // host, and remote patterns cannot be whitelisted ahead of time.
            return (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={url}
                alt={label}
                loading="lazy"
                className="my-2 max-w-full rounded-lg border border-white/10"
              />
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

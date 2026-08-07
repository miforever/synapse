/**
 * The wordmark, composed from the mark plus live text.
 *
 * An SVG loaded through <img> is an isolated document and does not inherit
 * the page's fonts, so the all-in-one lockup would render its wordmark in a
 * fallback face. Setting the text in HTML keeps it in Space Grotesk and lets
 * it size with the interface. The standalone lockup SVG stays for contexts
 * that need a single file, like the README.
 */

interface Props {
  size?: number;
  showTagline?: boolean;
}

export function Logo({ size = 44, showTagline = true }: Props) {
  return (
    <span className="inline-flex items-center gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/branding/synapsse-mark.svg"
        alt=""
        width={size}
        height={size}
        aria-hidden
      />
      <span className="flex flex-col justify-center">
        <span
          className="font-display font-bold leading-none tracking-[0.12em] text-strong"
          style={{ fontSize: size * 0.5 }}
        >
          SYNAPSSE
        </span>
        {showTagline && (
          <span
            className="mt-1 font-mono uppercase leading-none tracking-[0.25em] text-indigo"
            style={{ fontSize: size * 0.19 }}
          >
            Memory Graph Daemon
          </span>
        )}
      </span>
    </span>
  );
}

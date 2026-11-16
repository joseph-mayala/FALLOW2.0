/** Small marks in the plate's visual language. Decorative: the text beside each one carries the meaning. */

export function Logo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path d="M11 11V0.6A11.4 11.4 0 0 0 0.6 11Z" fill="var(--green-mid)" />
      <path d="M13 11h10.4A11.4 11.4 0 0 0 13 0.6Z" fill="var(--green-mid)" />
      <path d="M11 13H0.6A11.4 11.4 0 0 0 11 23.4Z" fill="var(--bar)" />
      <path d="M13 13v10.4A11.4 11.4 0 0 0 23.4 13Z" fill="var(--green-mid)" />
      <circle cx="17" cy="7.2" r="2.1" fill="var(--sun)" />
    </svg>
  );
}

export type GlyphKind = "low" | "single" | "nodata" | "arrow" | "month";

export function Glyph({ kind }: { kind: GlyphKind }) {
  const common = { className: "glyph", viewBox: "0 0 12 12", "aria-hidden": true, focusable: false } as const;
  if (kind === "low")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5" fill="none" stroke="var(--low)" strokeWidth="1.2" />
        <path d="M2.6 9.4 9.4 2.6M1.6 6.9 6.9 1.6M5.1 10.4l5.3-5.3" stroke="var(--low)" strokeWidth="0.9" />
      </svg>
    );
  if (kind === "single")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5" fill="none" stroke="var(--soft)" strokeWidth="1.1" />
      </svg>
    );
  if (kind === "nodata")
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="5" fill="none" stroke="var(--soft)" strokeWidth="1.1" strokeDasharray="2 1.6" />
      </svg>
    );
  if (kind === "month")
    return (
      <svg {...common}>
        <rect x="1" y="1" width="10" height="10" fill="var(--bar)" />
      </svg>
    );
  return (
    <svg {...common}>
      <path d="M1 6h9M6.5 2.5 10 6l-3.5 3.5" fill="none" stroke="var(--soft)" strokeWidth="1.1" />
    </svg>
  );
}

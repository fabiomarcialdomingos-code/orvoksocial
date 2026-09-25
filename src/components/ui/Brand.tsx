import Link from "next/link";

/** Two overlapping orbits: one perspective meeting another. */
export function BrandMark({ size = 26 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size * 0.7} viewBox="0 0 40 28" fill="none" aria-hidden="true">
      <circle cx="14" cy="14" r="11" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="26" cy="14" r="11" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <circle cx="20" cy="14" r="2.2" fill="var(--self)" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="ORVOK, página inicial">
      <BrandMark />
      <span className="brand-name">ORVOK</span>
    </Link>
  );
}

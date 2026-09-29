import Link from "next/link";

/** Órbita da marca: você no centro (âmbar), a rede ao redor (azul). */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg className="brand-mark" width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <circle cx="16" cy="16" r="13" stroke="currentColor" strokeWidth="2.4" />
      <ellipse cx="16" cy="16" rx="13" ry="5" stroke="#4C8DFF" strokeWidth="1.8" transform="rotate(-24 16 16)" />
      <circle cx="27.5" cy="10.8" r="2.4" fill="#4C8DFF" />
      <circle cx="16" cy="16" r="4.2" fill="#FFA834" />
    </svg>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="brand" aria-label="orvok, página inicial">
      <BrandMark />
      <span className="brand-name">orvok</span>
    </Link>
  );
}

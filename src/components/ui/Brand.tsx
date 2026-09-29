import Link from "next/link";
export function Brand({
  href = "/",
  className = "",
}: {
  href?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`brand ${className}`}
      aria-label="ORVOK — início"
    >
      <svg
        viewBox="0 0 28 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        aria-hidden="true"
      >
        <path d="M4 22V5h17M9 5l12 12M11 12h10v10M9 22 24 7M17 7h7v8" />
      </svg>
      <span>
        orvok<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}

export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 28 28"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      aria-hidden="true"
    >
      <path d="M4 22V5h17M9 5l12 12M11 12h10v10M9 22 24 7M17 7h7v8" />
    </svg>
  );
}

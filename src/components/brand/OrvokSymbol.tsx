import type { SVGProps } from "react";
type SymbolProps = SVGProps<SVGSVGElement> & {
  size?: number;
  variant?: "dark" | "light";
  animated?: boolean;
};
export function OrvokSymbol({
  size = 46,
  variant = "dark",
  animated = false,
  ...props
}: SymbolProps) {
  return (
    <svg
      viewBox="0 0 240 180"
      width={size}
      height={size * 0.75}
      fill="none"
      role="img"
      aria-label="Símbolo ORVOK: duas perspectivas conectadas"
      data-variant={variant}
      data-animated={animated}
      {...props}
    >
      <circle
        cx="80"
        cy="90"
        r="55"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
      <circle
        cx="160"
        cy="90"
        r="55"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
      <line
        x1="120"
        y1="20"
        x2="120"
        y2="160"
        stroke="currentColor"
        strokeWidth="1.25"
        vectorEffect="non-scaling-stroke"
      />
      <circle cx="120" cy="20" r="3" fill="currentColor" />
      <circle cx="120" cy="90" r="6" fill="currentColor" />
      <circle cx="120" cy="160" r="3" fill="currentColor" />
    </svg>
  );
}

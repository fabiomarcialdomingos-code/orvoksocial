import { OrvokSymbol } from "./OrvokSymbol";
export function OrvokLogo({
  variant = "horizontal",
}: {
  variant?: "primary" | "horizontal" | "monochrome" | "icon";
}) {
  return (
    <span className="brand-link" data-variant={variant}>
      <OrvokSymbol aria-hidden="true" size={44} />
      {variant !== "icon" && <span className="brand-word">ORVOK</span>}
    </span>
  );
}

"use client";

import { useEffect } from "react";

/** One listener for the whole document: writes the pointer position into the
 *  hovered `.lit` element so its border and surface catch the light. */
export function Spotlight() {
  useEffect(() => {
    if (window.matchMedia("(hover: none)").matches) return;
    let current: HTMLElement | null = null;
    const onMove = (event: PointerEvent) => {
      const target = (event.target as Element | null)?.closest?.<HTMLElement>(".lit") ?? null;
      if (current && current !== target) {
        current.style.removeProperty("--mx");
        current.style.removeProperty("--my");
      }
      current = target;
      if (!target) return;
      const rect = target.getBoundingClientRect();
      target.style.setProperty("--mx", `${event.clientX - rect.left}px`);
      target.style.setProperty("--my", `${event.clientY - rect.top}px`);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, []);
  return null;
}

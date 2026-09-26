"use client";

import { useEffect } from "react";

/** Drives every scroll-triggered effect on the home page: fade-ins,
 *  tally bars filling, the step-list progress line, and the field glow
 *  brightening near the closing call to action. No visual output of its own. */
export function ScrollEffects() {
  useEffect(() => {
    const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const revealIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-in", "true");
            revealIo.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.2 },
    );
    reveals.forEach((el) => revealIo.observe(el));

    const bars = Array.from(document.querySelectorAll<HTMLElement>("[data-tally-fill]"));
    const barIo = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            const target = entry.target as HTMLElement;
            target.style.width = target.dataset.tallyFill ?? "0%";
            barIo.unobserve(target);
          }
        }
      },
      { threshold: 0.4 },
    );
    bars.forEach((el) => barIo.observe(el));

    const glow = document.getElementById("field-glow");
    const closing = document.getElementById("comecar");
    let glowIo: IntersectionObserver | undefined;
    if (glow && closing) {
      glowIo = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) glow.setAttribute("data-bright", String(entry.isIntersecting));
        },
        { threshold: 0.3 },
      );
      glowIo.observe(closing);
    }

    const stepsSection = document.getElementById("steps-section");
    const stepFill = document.getElementById("step-fill");
    function onScroll() {
      if (!stepsSection || !stepFill) return;
      const rect = stepsSection.getBoundingClientRect();
      const total = rect.height - window.innerHeight * 0.5;
      const progressed = window.innerHeight * 0.7 - rect.top;
      const pct = Math.max(0, Math.min(1, progressed / Math.max(total, 1)));
      stepFill.style.height = `${pct * 100}%`;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();

    return () => {
      revealIo.disconnect();
      barIo.disconnect();
      glowIo?.disconnect();
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return null;
}

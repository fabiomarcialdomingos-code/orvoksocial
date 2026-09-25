"use client";

import { useEffect, useId, useRef } from "react";

export type InstrumentNode = {
  id: string;
  label?: string | undefined;
  /** Perspective color: self (you), people, world. */
  p: "self" | "people" | "world";
  /** Distance from the center, 0 (center) to 1 (outer ring). */
  r: number;
  /** Angle in degrees, 0 = right, clockwise. */
  angle: number;
  size?: number;
  /** Draw a link to the center (a connection that exists). */
  linked?: boolean;
};

const COLORS = { self: "var(--self)", people: "var(--people)", world: "var(--world)" } as const;
const SIZE = 600;
const C = SIZE / 2;
const R = SIZE / 2 - 34;

function polar(r: number, angle: number) {
  const a = (angle * Math.PI) / 180;
  return { x: C + Math.cos(a) * r * R, y: C + Math.sin(a) * r * R };
}

/**
 * The ORVOK instrument: concentric rings, a gaze beam and perspective nodes.
 * The beam follows the pointer; nodes inside it light up and show their
 * connection. Without a pointer the beam sweeps slowly; with reduced motion it
 * rests. Rendering is a static SVG, the beam is updated through refs so a
 * moving pointer never re-renders React.
 */
export function Instrument({
  nodes,
  label,
  interactive = true,
  sweep = true,
  centerLabel,
}: {
  nodes: InstrumentNode[];
  label: string;
  interactive?: boolean;
  sweep?: boolean;
  centerLabel?: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const beamRef = useRef<SVGGElement>(null);
  const gradId = useId().replace(/:/g, "");

  useEffect(() => {
    const svg = svgRef.current;
    const beam = beamRef.current;
    if (!svg || !beam) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let angle = -40;
    let target = angle;
    let pointerActive = false;
    let frame = 0;
    let last = performance.now();
    const nodeEls = Array.from(svg.querySelectorAll<SVGGElement>("[data-node]"));

    const paint = () => {
      beam.setAttribute("transform", `rotate(${angle} ${C} ${C})`);
      for (const el of nodeEls) {
        const a = Number(el.dataset.angle);
        let d = Math.abs(((a - angle + 540) % 360) - 180);
        if (el.dataset.center === "true") d = 0;
        const lit = d < 28;
        el.dataset.lit = String(lit);
        const glow = Math.max(0, 1 - d / 28);
        el.style.setProperty("--glow", glow.toFixed(3));
      }
    };

    const tick = (now: number) => {
      const dt = Math.min(64, now - last);
      last = now;
      if (!pointerActive && sweep && !reduced) target += dt * 0.012;
      const diff = ((target - angle + 540) % 360) - 180;
      angle += diff * Math.min(1, dt / 140);
      paint();
      frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      const rect = svg.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * SIZE - C;
      const y = ((event.clientY - rect.top) / rect.height) * SIZE - C;
      target = (Math.atan2(y, x) * 180) / Math.PI;
      pointerActive = true;
    };
    const onLeave = () => { pointerActive = false; };

    paint();
    if (!reduced || interactive) frame = requestAnimationFrame(tick);
    if (interactive) {
      window.addEventListener("pointermove", onMove, { passive: true });
      document.addEventListener("pointerleave", onLeave);
    }
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, [interactive, sweep, nodes]);

  return (
    <svg ref={svgRef} className="instrument" viewBox={`0 0 ${SIZE} ${SIZE}`} role="img" aria-label={label}>
      <defs>
        <radialGradient id={`${gradId}-core`}>
          <stop offset="0%" stopColor="var(--self)" stopOpacity="0.35" />
          <stop offset="100%" stopColor="var(--self)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={`${gradId}-beam`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--people)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--people)" stopOpacity="0.16" />
        </linearGradient>
      </defs>

      {[0.25, 0.5, 0.75, 1].map((ring) => (
        <circle key={ring} className={`ring ${ring === 1 ? "ring-strong" : ""}`} cx={C} cy={C} r={ring * R} />
      ))}
      {Array.from({ length: 72 }, (_, i) => {
        const inner = polar(i % 6 === 0 ? 0.965 : 0.985, i * 5);
        const outer = polar(1, i * 5);
        return <line key={i} className="tick" x1={inner.x} y1={inner.y} x2={outer.x} y2={outer.y} opacity={i % 6 === 0 ? 0.9 : 0.4} />;
      })}
      <line className="ring" x1={C - R} y1={C} x2={C + R} y2={C} strokeDasharray="2 6" />
      <line className="ring" x1={C} y1={C - R} x2={C} y2={C + R} strokeDasharray="2 6" />

      <g ref={beamRef} className="beam" aria-hidden="true">
        <path d={`M ${C} ${C} L ${polar(1, -26).x} ${polar(1, -26).y} A ${R} ${R} 0 0 1 ${polar(1, 26).x} ${polar(1, 26).y} Z`}
          fill={`url(#${gradId}-beam)`} transform={`rotate(0 ${C} ${C})`} />
        <line x1={C} y1={C} x2={C + R} y2={C} stroke="var(--people)" strokeOpacity="0.5" />
      </g>

      {nodes.filter((node) => node.linked).map((node) => {
        const pos = polar(node.r, node.angle);
        return (
          <line key={`l-${node.id}`} className="link" x1={C} y1={C} x2={pos.x} y2={pos.y}
            stroke={COLORS[node.p]} strokeOpacity="0.35" strokeDasharray="3 5" />
        );
      })}

      <circle cx={C} cy={C} r={70} fill={`url(#${gradId}-core)`} />

      {nodes.map((node) => {
        const pos = polar(node.r, node.angle);
        const size = node.size ?? 6;
        const labelLeft = pos.x < C - 10;
        return (
          <g key={node.id} className="node" data-node data-angle={node.angle} data-center={node.r < 0.05}
            style={{ ["--glow" as string]: 0 }}>
            <circle cx={pos.x} cy={pos.y} r={size * 3.2} fill={COLORS[node.p]}
              style={{ opacity: "calc(var(--glow) * 0.22)" }} />
            <circle className="core" cx={pos.x} cy={pos.y} r={size} fill={COLORS[node.p]}
              style={{ opacity: "calc(0.55 + var(--glow) * 0.45)" }} />
            {node.label && (
              <text x={pos.x + (labelLeft ? -size - 8 : size + 8)} y={pos.y + 4} textAnchor={labelLeft ? "end" : "start"}
                style={{ opacity: "calc(0.45 + var(--glow) * 0.55)" }}>
                {node.label}
              </text>
            )}
          </g>
        );
      })}
      {centerLabel && (
        <text x={C} y={C + 32} textAnchor="middle" fill="var(--text-2)" fontSize="12" fontFamily="var(--font-ui)">{centerLabel}</text>
      )}
    </svg>
  );
}

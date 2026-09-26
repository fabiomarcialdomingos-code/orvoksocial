"use client";

import { useEffect, useRef } from "react";

type Node = { x: number; y: number; vx: number; vy: number; r: number };

/** Fixed full-viewport canvas: a live network that drifts, reacts to the
 *  pointer, and occasionally pulses amber to suggest a reading forming. */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let width = 0;
    let height = 0;
    let nodes: Node[] = [];
    const mouse = { x: -9999, y: -9999 };
    let pulse: [number, number] | null = null;
    let pulseTimer = 0;
    let frame = 0;

    function resize() {
      width = canvas!.width = window.innerWidth;
      height = canvas!.height = window.innerHeight;
      const count = Math.min(90, Math.round((width * height) / 22000));
      nodes = Array.from({ length: count }, () => ({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.18,
        vy: (Math.random() - 0.5) * 0.18,
        r: 1 + Math.random() * 1.4,
      }));
    }

    function onMove(event: MouseEvent) {
      mouse.x = event.clientX;
      mouse.y = event.clientY;
    }
    function onLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    function step() {
      ctx!.clearRect(0, 0, width, height);

      for (const n of nodes) {
        const dx = n.x - mouse.x;
        const dy = n.y - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 14400) {
          const f = ((14400 - d2) / 14400) * 0.02;
          const d = Math.sqrt(d2) || 1;
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
        n.x += n.vx;
        n.y += n.vy;
        n.vx *= 0.985;
        n.vy *= 0.985;
        if (n.x < -20) n.x = width + 20;
        if (n.x > width + 20) n.x = -20;
        if (n.y < -20) n.y = height + 20;
        if (n.y > height + 20) n.y = -20;
      }

      ctx!.lineWidth = 1;
      for (let a = 0; a < nodes.length; a++) {
        for (let b = a + 1; b < nodes.length; b++) {
          const na = nodes[a];
          const nb = nodes[b];
          if (!na || !nb) continue;
          const dist = Math.hypot(na.x - nb.x, na.y - nb.y);
          if (dist < 130) {
            const isPulse = !!pulse && ((pulse[0] === a && pulse[1] === b) || (pulse[0] === b && pulse[1] === a));
            const op = (1 - dist / 130) * (isPulse ? 0.9 : 0.16);
            ctx!.strokeStyle = isPulse ? `rgba(207,143,63,${op})` : `rgba(239,236,228,${op})`;
            ctx!.beginPath();
            ctx!.moveTo(na.x, na.y);
            ctx!.lineTo(nb.x, nb.y);
            ctx!.stroke();
          }
        }
      }

      ctx!.fillStyle = "rgba(239,236,228,0.55)";
      for (const n of nodes) {
        ctx!.beginPath();
        ctx!.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx!.fill();
      }

      pulseTimer--;
      if (pulseTimer <= 0 && nodes.length > 4) {
        pulse = [Math.floor(Math.random() * nodes.length), Math.floor(Math.random() * nodes.length)];
        pulseTimer = 90 + Math.random() * 120;
      }

      frame = requestAnimationFrame(step);
    }

    resize();
    window.addEventListener("resize", resize);
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);

    if (!reduced) frame = requestAnimationFrame(step);
    else step();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return <canvas ref={canvasRef} aria-hidden="true" />;
}

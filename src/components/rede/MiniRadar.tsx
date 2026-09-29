import s from "./rede.module.css";

/** Radar pequeno do placar: acertos perto do centro, erros na borda. */
export function MiniRadar({ acertos, total = 10 }: { acertos: number; total?: number }) {
  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      {[56, 38, 20].map((r) => <circle key={r} cx="60" cy="60" r={r} fill="none" stroke="var(--line-strong)" />)}
      <g className={s.varre}><path d="M60 60 L60 4 A56 56 0 0 1 107 30 Z" fill="var(--people)" opacity=".16" /></g>
      {Array.from({ length: total }, (_, i) => {
        const a = (i / total) * Math.PI * 2 - Math.PI / 2, ok = i < acertos, r = ok ? 24 + (i % 3) * 5 : 46 + (i % 2) * 5;
        return <circle key={i} cx={60 + Math.cos(a) * r} cy={60 + Math.sin(a) * r} r={ok ? 4 : 3} fill={ok ? "var(--self)" : "var(--panel-3)"} style={ok ? { filter: "drop-shadow(0 0 4px #FFA834)" } : undefined} />;
      })}
      <circle cx="60" cy="60" r="9" fill="var(--self)" />
    </svg>
  );
}

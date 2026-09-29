"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useShell } from "../app/AppShell";
import { Avatar } from "../app/AppShell";
import { ROTULO_RELACAO, useDesafios, type Relacao } from "./dados";
import s from "./rede.module.css";

const COR: Record<Relacao, string> = { familia: "#FFA834", amigos: "#4C8DFF", crush: "#FF4F82" };
const hash = (t: string) => [...t].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

/**
 * Meu radar: você no centro e cada pessoa que respondeu um desafio seu na
 * distância do placar. Quem acertou mais fica mais perto.
 */
export function RadarVivo() {
  const { profile } = useShell();
  const { dados } = useDesafios();
  const [filtro, setFiltro] = useState<Relacao | "todos">("todos");
  const [foco, setFoco] = useState<number | null>(null);

  const pessoas = useMemo(() => {
    const melhor = new Map<string, { nome: string; relacao: Relacao; acertos: number; total: number }>();
    for (const d of dados?.enviados ?? []) for (const t of d.tentativas) {
      const nome = t.nome ?? "Alguém", chave = `${nome}|${d.relacao}`, atual = melhor.get(chave);
      if (!atual || (t.score ?? 0) > atual.acertos) melhor.set(chave, { nome, relacao: d.relacao, acertos: t.score ?? 0, total: t.total ?? 10 });
    }
    return [...melhor.values()].filter((p) => filtro === "todos" || p.relacao === filtro).sort((a, b) => b.acertos - a.acertos);
  }, [dados, filtro]);

  const R = 200, C = 220;
  const nos = pessoas.map((p, i) => {
    const dist = 38 + (1 - p.acertos / p.total) * (R - 50);
    const ang = ((hash(p.nome) % 360) + i * 47) * (Math.PI / 180);
    return { ...p, x: C + Math.cos(ang) * dist, y: C + Math.sin(ang) * dist };
  });
  const focado = foco !== null ? nos[foco] : null;

  return (
    <>
      <div className={s.abas} role="tablist" aria-label="Filtrar por relação">
        {(["todos", "familia", "amigos", "crush"] as const).map((f) => (
          <button key={f} role="tab" type="button" aria-selected={filtro === f} onClick={() => { setFiltro(f); setFoco(null); }}>{f === "todos" ? "Todos" : ROTULO_RELACAO[f]}</button>
        ))}
      </div>

      <div className={s.radarPalco}>
        <svg viewBox="0 0 440 440" role="img" aria-label={`Seu radar com ${nos.length} ${nos.length === 1 ? "pessoa" : "pessoas"}`}>
          <defs>
            <radialGradient id="fundoRadar"><stop offset="0" stopColor="#0D2756" /><stop offset=".75" stopColor="#071734" /><stop offset="1" stopColor="#040C1E" /></radialGradient>
            <linearGradient id="feixe" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4C8DFF" stopOpacity=".45" /><stop offset="1" stopColor="#4C8DFF" stopOpacity="0" /></linearGradient>
            <filter id="brilho" x="-1" y="-1" width="3" height="3"><feGaussianBlur stdDeviation="4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          <circle cx={C} cy={C} r={R + 12} fill="url(#fundoRadar)" stroke="rgba(127,178,255,.55)" style={{ filter: "drop-shadow(0 0 18px rgba(76,141,255,.5))" }} />
          {[R, R * 0.7, R * 0.4].map((r) => <circle key={r} cx={C} cy={C} r={r} fill="none" stroke="rgba(127,178,255,.16)" strokeDasharray="2 6" />)}
          <g className={s.varre} style={{ transformOrigin: `${C}px ${C}px` }}><path d={`M${C} ${C} L${C} ${C - R} A${R} ${R} 0 0 1 ${C + R * 0.87} ${C - R * 0.5} Z`} fill="url(#feixe)" /></g>
          {nos.map((n, i) => <line key={`l${i}`} x1={C} y1={C} x2={n.x} y2={n.y} stroke={COR[n.relacao]} strokeOpacity={foco === i ? 0.9 : 0.22} strokeDasharray="3 5" />)}
          {nos.map((n, i) => (
            <g key={n.nome + n.relacao} className={s.no} tabIndex={0} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)} onFocus={() => setFoco(i)} onBlur={() => setFoco(null)}>
              <circle cx={n.x} cy={n.y} r="17" fill={COR[n.relacao]} filter="url(#brilho)" opacity=".9" />
              <text x={n.x} y={n.y + 5} textAnchor="middle" fontSize="14" fontWeight="700" fill="#fff">{n.nome[0]?.toUpperCase()}</text>
            </g>
          ))}
          <circle cx={C} cy={C} r="26" fill="#FFA834" filter="url(#brilho)" />
          <text x={C} y={C + 6} textAnchor="middle" fontSize="17" fontWeight="800" fill="#231400">{(profile?.displayName ?? "V")[0]?.toUpperCase()}</text>
        </svg>
        {focado ? <div className={s.dica} style={{ left: `${(focado.x / 440) * 100}%`, top: `${(focado.y / 440) * 100}%` }}><b>{focado.nome}</b>acertou {focado.acertos} de {focado.total} · {ROTULO_RELACAO[focado.relacao]}</div> : null}
      </div>

      {dados && nos.length === 0 ? (
        <div className={s.vazio}><strong>Seu radar ainda está vazio.</strong><span>Cada pessoa que responder um desafio seu aparece aqui, mais perto quanto mais ela acertar.</span><Link className={s.btnP} href="/comecar">Desafiar alguém</Link></div>
      ) : (
        <section aria-labelledby="t-ranking">
          <h2 id="t-ranking" style={{ fontSize: 18, fontWeight: 800, margin: "0 0 6px" }}>Quem mais te conhece</h2>
          <div className={s.ranking}>
            {nos.map((n, i) => (
              <div key={n.nome + n.relacao} className={s.linha} onMouseEnter={() => setFoco(i)} onMouseLeave={() => setFoco(null)}>
                <span className={s.posicao}>{i + 1}</span>
                <Avatar nome={n.nome} tamanho={36} />
                <span className={s.nome}><b>{n.nome}</b> <span className={`${s.rel} ${s[`rel_${n.relacao}`]}`}>{ROTULO_RELACAO[n.relacao]}</span></span>
                <strong>{n.acertos} de {n.total}</strong>
              </div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

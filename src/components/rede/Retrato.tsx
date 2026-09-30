"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { IconeRede } from "../app/AppShell";
import s from "./rede.module.css";

type Item = { chave: string; texto: string; tema: string; voce: string; maioria: string; total: number; concordam: number; votosMaioria: number; tipo: "cego" | "acordo" | "dividido" };
type Dados = { perguntas: Item[]; pendentes: number; respondentes: number };

/** Espelho: dois círculos (você e quem te conhece), sobrepostos na medida em que concordam. */
function Espelho({ indice }: { indice: number }) {
  const d = 150 - indice * 110; // distância entre os centros: quanto mais concordância, mais sobreposição
  return (
    <svg viewBox="0 0 360 214" className={s.espelho} aria-hidden="true">
      <defs>
        <radialGradient id="gVoce"><stop offset="0" stopColor="#FFC46B" stopOpacity=".55" /><stop offset="1" stopColor="#FFA834" stopOpacity=".1" /></radialGradient>
        <radialGradient id="gOutros"><stop offset="0" stopColor="#7FB2FF" stopOpacity=".55" /><stop offset="1" stopColor="#4C8DFF" stopOpacity=".1" /></radialGradient>
      </defs>
      <g className={s.espelhoVoce}><circle cx={180 - d / 2} cy="96" r="80" fill="url(#gVoce)" stroke="#FFA834" strokeOpacity=".7" /><text x={180 - d / 2 - 30} y="208" fill="#FFD39A" fontSize="13" fontWeight="700" textAnchor="middle">Você</text></g>
      <g className={s.espelhoOutros}><circle cx={180 + d / 2} cy="96" r="80" fill="url(#gOutros)" stroke="#4C8DFF" strokeOpacity=".8" /><text x={180 + d / 2 + 30} y="208" fill="#BFD7FF" fontSize="13" fontWeight="700" textAnchor="middle">Quem te conhece</text></g>
      <text x="180" y="104" fill="#fff" fontSize="26" fontWeight="800" textAnchor="middle">{Math.round(indice * 100)}%</text>
    </svg>
  );
}

/** Retrato "como você se vê vs. como te veem". */
export function Retrato() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => {
    let ativo = true;
    fetch("/api/v1/desafio/retrato", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { perguntas: [], pendentes: 0, respondentes: 0 }))
      .then((x: Dados) => { if (ativo) setD(x); }).catch(() => { if (ativo) setD({ perguntas: [], pendentes: 0, respondentes: 0 }); });
    return () => { ativo = false; };
  }, []);
  if (!d) return <p className={s.muted} aria-busy="true">Montando seu retrato…</p>;

  const cegos = d.perguntas.filter((p) => p.tipo === "cego");
  const acordos = d.perguntas.filter((p) => p.tipo === "acordo");
  const divididos = d.perguntas.filter((p) => p.tipo === "dividido");
  const indice = d.perguntas.length ? d.perguntas.reduce((n, p) => n + p.concordam / p.total, 0) / d.perguntas.length : 0;

  if (d.perguntas.length === 0) return (
    <>
      <section className={s.hero}>
        <small className={s.marcador}>Seu retrato</small>
        <h2>Como você se vê vs. como te veem</h2>
        <p>Quando pelo menos 3 pessoas responderem os seus desafios, o orvok mostra onde elas te enxergam do jeito que você se vê e onde está o seu ponto cego.</p>
        <div className={s.chips}><Link className={s.btnP} href="/comecar">Desafiar mais gente</Link></div>
      </section>
      <div className={s.vazio}>
        <strong>{d.pendentes ? `${d.pendentes} ${d.pendentes === 1 ? "pergunta está" : "perguntas estão"} quase prontas.` : "Seu retrato começa com 3 respostas."}</strong>
        <span>Para proteger quem responde, cada pergunta só aparece quando pelo menos 3 pessoas responderam. Ninguém sabe quem marcou o quê.</span>
      </div>
    </>
  );

  return (
    <>
      <section className={s.hero}>
        <small className={s.marcador}>Seu retrato, com {d.respondentes} {d.respondentes === 1 ? "pessoa" : "pessoas"}</small>
        <h2>As pessoas te enxergam como você se vê em {Math.round(indice * 100)}% das respostas.</h2>
        <Espelho indice={indice} />
        <p className={s.muted} style={{ margin: 0 }}>Cada pergunta só entra aqui com pelo menos 3 pessoas. Ninguém é identificado.</p>
      </section>

      {cegos.length ? (
        <section aria-labelledby="t-cegos">
          <h2 id="t-cegos" className={s.tituloSecao}><IconeRede nome="radar" />Seus pontos cegos</h2>
          {cegos.map((p) => (
            <article key={p.chave} className={`${s.item} ${s.cego}`}>
              <b>{p.texto}</b>
              <div className={s.duelo}>
                <div className={s.ladoVoce}><small>Você disse</small><span>{p.voce}</span></div>
                <span className={s.diferente} aria-hidden="true">≠</span>
                <div className={s.ladoOutros}><small>{p.votosMaioria} de {p.total} acham</small><span>{p.maioria}</span></div>
              </div>
            </article>
          ))}
        </section>
      ) : null}

      {acordos.length ? (
        <section aria-labelledby="t-acordo">
          <h2 id="t-acordo" className={s.tituloSecao}><IconeRede nome="pessoas" />Onde todos te veem como você se vê</h2>
          {acordos.map((p) => (
            <div key={p.chave} className={s.linha}>
              <span className={s.check} style={{ background: "#2dd4a0", color: "#04241a", borderColor: "transparent" }}>✓</span>
              <span className={s.nome}><b>{p.texto}</b><br /><span className={s.muted}>{p.voce}</span></span>
              <strong>{p.concordam} de {p.total}</strong>
            </div>
          ))}
        </section>
      ) : null}

      {divididos.length ? (
        <section aria-labelledby="t-divididos" style={{ marginTop: 18 }}>
          <h2 id="t-divididos" className={s.tituloSecao}><IconeRede nome="alvo" />Opiniões divididas</h2>
          {divididos.map((p) => (
            <div key={p.chave} className={s.linha}>
              <span className={s.nome}><b>{p.texto}</b><br /><span className={s.muted}>Você: {p.voce}. Só {p.concordam} de {p.total} apostaram nisso.</span></span>
            </div>
          ))}
        </section>
      ) : null}

      {d.pendentes ? <p className={s.muted} style={{ marginTop: 18 }}>Mais {d.pendentes} {d.pendentes === 1 ? "pergunta aparece" : "perguntas aparecem"} quando mais gente responder. <Link className="text-link" href="/comecar">Desafiar mais alguém</Link></p> : null}
    </>
  );
}

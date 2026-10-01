"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ROTULO_RELACAO, type Relacao } from "./dados";
import { notaSobrePercepcao } from "../../lib/desafio/soka";
import type { Traco } from "../../lib/desafio/nucleo";
import s from "./rede.module.css";

type Perfil = { nome: string; frase: string; descricao: string; marcantes: string[]; tracos: { traco: string; nome: string; polo: string; forca: number }[] };
type Selo = { batem: number; nivel: "autentico" | "prata" | "bronze" | null; titulo: string | null; frase: string };
type Dados = { eu: Perfil | null; eles: Perfil | null; selo: Selo | null; respondentes: number; faltam: number; relacoes: { relacao: Relacao; respondentes: number; selo: Selo | null }[] };

const COR_SELO = { autentico: "#FFD166", prata: "#D7E3F4", bronze: "#E0A06A" } as const;

function Medalha({ selo }: { selo: Selo }) {
  const cor = selo.nivel ? COR_SELO[selo.nivel] : "#8E9AB0";
  return (
    <div className={s.medalha} style={{ ["--cor" as string]: cor }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle cx="60" cy="60" r="52" fill="none" stroke={cor} strokeWidth="3" strokeDasharray="4 6" className={s.medalhaGira} />
        <circle cx="60" cy="60" r="40" fill={cor} opacity=".18" />
        <circle cx="60" cy="60" r="40" fill="none" stroke={cor} strokeWidth="2" />
        <text x="60" y="68" textAnchor="middle" fontSize="26" fontWeight="800" fill={cor}>{selo.batem}/6</text>
      </svg>
      <div><b>{selo.titulo ?? "Ainda sem selo"}</b><span>{selo.frase}</span></div>
    </div>
  );
}

/** Meu retrato: como você se vê, como te veem e o selo. */
export function Retrato() {
  const [d, setD] = useState<Dados | null>(null);
  useEffect(() => {
    let ativo = true;
    fetch("/api/v1/desafio/retrato", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((x: Dados | null) => { if (ativo) setD(x ?? { eu: null, eles: null, selo: null, respondentes: 0, faltam: 3, relacoes: [] }); })
      .catch(() => { if (ativo) setD({ eu: null, eles: null, selo: null, respondentes: 0, faltam: 3, relacoes: [] }); });
    return () => { ativo = false; };
  }, []);
  if (!d) return <p className={s.muted} aria-busy="true">Montando seu retrato…</p>;

  if (!d.eu) return (
    <section className={s.hero}>
      <small className={s.marcador}>Seu retrato</small>
      <h2>Descubra como você se vê e como te veem.</h2>
      <p>Responda 12 perguntas sobre você para ver o seu perfil. Depois, quem você convidar diz como te enxerga. Com 3 respostas, aparece o seu retrato e o seu selo.</p>
      <div className={s.chips}><Link className={s.btnP} href="/comecar?tipo=retrato">Fazer o Retrato</Link></div>
    </section>
  );

  return (
    <>
      <section className={s.hero}>
        <small className={s.marcador}>Como você se vê</small>
        <h2>{d.eu.nome}</h2>
        <p style={{ marginBottom: 10 }}>{d.eu.descricao}</p>
        <div className={s.chips}>{d.eu.marcantes.map((m) => <span key={m} className={`${s.rel} ${s.rel_familia}`} style={{ fontSize: 13, padding: "4px 12px" }}>{m}</span>)}</div>
      </section>

      {d.eles && d.selo ? (
        <>
          <Medalha selo={d.selo} />
          <section className={s.item}>
            <div className={s.itemCab}><b>Como te veem: {d.eles.nome}</b><span className={s.muted}>{d.respondentes} pessoas</span></div>
            <div className={s.comparacao}>
              {d.eu.tracos.map((t, k) => {
                const o = d.eles!.tracos[k]!, bate = o.polo === t.polo;
                return (
                  <div key={t.traco} className={`${s.linhaTraco} ${bate ? "" : s.diverge}`}>
                    <span className={s.nomeTraco}>{t.nome}</span>
                    <span className={s.voceTraco}>{t.polo}</span>
                    <span className={s.sinal} aria-label={bate ? "bate" : "diferente"}>{bate ? "=" : "≠"}</span>
                    <span className={s.elesTraco}>{o.polo}</span>
                  </div>
                );
              })}
            </div>
            <p className={s.muted} style={{ margin: 0 }}>À esquerda, como você se vê. À direita, a média de quem te respondeu. Ninguém é identificado.</p>
            {[...new Set(d.eu.tracos.map((t, k) => notaSobrePercepcao(t.traco as Traco, d.eles!.tracos[k]!.polo === t.polo)).filter((x): x is string => x !== null))]
              .map((nota) => <p key={nota} className={s.notaSoka}>{nota}</p>)}
          </section>
          <section className={s.item}>
            <b>Selo por relação</b>
            {d.relacoes.map((r) => (
              <div key={r.relacao} className={s.linha}>
                <span className={`${s.rel} ${s[`rel_${r.relacao}`]}`}>{ROTULO_RELACAO[r.relacao]}</span>
                <span className={s.nome}>{r.selo ? (r.selo.titulo ?? "Te veem diferente") : `${r.respondentes} de 3 pessoas`}</span>
                {r.selo ? <strong>{r.selo.batem}/6</strong> : <Link className={s.btnFio} href={`/comecar?rel=${r.relacao}`}>Desafiar</Link>}
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className={s.item}>
          <b>Como te veem</b>
          <div className={s.progressoRetrato} aria-label={`${d.respondentes} de 3 pessoas`}>{[0, 1, 2].map((k) => <i key={k} className={k < d.respondentes ? s.ok : ""} />)}</div>
          <p className={s.muted} style={{ margin: 0 }}>Faltam {d.faltam} {d.faltam === 1 ? "pessoa" : "pessoas"} para aparecer como te enxergam e descobrir o seu selo. Para proteger quem responde, só mostramos com pelo menos 3.</p>
          <div className={s.chips}><Link className={s.btnP} href="/comecar?tipo=retrato">Convidar mais gente</Link></div>
        </section>
      )}
    </>
  );
}

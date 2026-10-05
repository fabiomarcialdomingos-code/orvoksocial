"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ROTULO_RELACAO, type Relacao } from "./dados";
import { notaSobrePercepcao } from "../../lib/desafio/soka";
import { ORDEM_TRACOS, TRACOS, type Traco } from "../../lib/desafio/nucleo";
import { apiPost } from "../../lib/client/api";
import s from "./rede.module.css";

type Perfil = { nome: string; frase: string; descricao: string; marcantes: string[]; tracos: { traco: string; nome: string; polo: string; forca: number }[] };
type Selo = { batem: number; nivel: "autentico" | "prata" | "bronze" | null; titulo: string | null; frase: string };
type Dados = { eu: Perfil | null; eles: Perfil | null; selo: Selo | null; respondentes: number; faltam: number; relacoes: { relacao: Relacao; respondentes: number; selo: Selo | null }[]; ocultos: Traco[]; apareceram: Traco[] };
type Marco = { em: string; respondentes: number; batem: number; nivel: "autentico" | "prata" | "bronze" | null };
const NIVEL_NOME = { autentico: "nítido", prata: "em foco", bronze: "em revelação" } as const;
const VAZIO: Dados = { eu: null, eles: null, selo: null, respondentes: 0, faltam: 3, relacoes: [], ocultos: [], apareceram: [] };

/** Uma cor só (o âmbar do orvok): o que muda é o foco, não o metal. */
const COR_NITIDEZ = "#FFB84D";
const COR_SEM_NIVEL = "#8E9AB0";
/** Desfoque do miolo e traço do anel por nível: quanto mais nítido o retrato, mais definido o desenho. */
const FOCO = {
  autentico: { desfoque: 0, anel: undefined as string | undefined },
  prata: { desfoque: 1.4, anel: "2 3" },
  bronze: { desfoque: 3, anel: "1 5" },
} as const;

function Nitidez({ selo }: { selo: Selo }) {
  const cor = selo.nivel ? COR_NITIDEZ : COR_SEM_NIVEL;
  const foco = selo.nivel ? FOCO[selo.nivel] : { desfoque: 4, anel: "1 7" as string | undefined };
  return (
    <div className={s.nitidez} style={{ ["--cor" as string]: cor }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <defs><filter id="foco-nitidez" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation={foco.desfoque} /></filter></defs>
        <circle cx="60" cy="60" r="52" fill="none" stroke={cor} strokeWidth="3" {...(foco.anel ? { strokeDasharray: foco.anel, strokeLinecap: "round" as const } : {})} className={s.nitidezGira} />
        <g filter={foco.desfoque ? "url(#foco-nitidez)" : undefined}>
          <circle cx="60" cy="60" r="40" fill={cor} opacity=".2" />
          <circle cx="60" cy="60" r="40" fill="none" stroke={cor} strokeWidth="2" />
        </g>
        <text x="60" y="68" textAnchor="middle" fontSize="26" fontWeight="800" fill={cor}>{selo.batem}/6</text>
      </svg>
      <div><b>{selo.titulo ?? "Retrato de contrastes"}</b><span>{selo.frase}</span></div>
    </div>
  );
}

/** Meu retrato: como você se vê, como te veem e o quanto ele está nítido. */
export function Retrato() {
  const [d, setD] = useState<Dados | null>(null);
  const [linha, setLinha] = useState<Marco[] | null>(null);
  useEffect(() => {
    let ativo = true;
    fetch("/api/v1/desafio/retrato", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((x: Dados | null) => { if (ativo) setD(x ?? VAZIO); })
      .catch(() => { if (ativo) setD(VAZIO); });
    fetch("/api/v1/desafio/linha-do-tempo", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null)).then((x: { marcos: Marco[] } | null) => { if (ativo) setLinha(x?.marcos ?? []); })
      .catch(() => { if (ativo) setLinha([]); });
    return () => { ativo = false; };
  }, []);
  if (!d) return <p className={s.muted} aria-busy="true">Montando seu retrato…</p>;
  const alternarOculto = async (traco: Traco) => {
    const ligar = !d.ocultos.includes(traco);
    setD({ ...d, ocultos: ligar ? [...d.ocultos, traco] : d.ocultos.filter((t) => t !== traco) });
    await apiPost("/desafio/oculto", { traco, oculto: ligar }).catch(() => undefined);
  };

  if (!d.eu) return (
    <section className={s.hero}>
      <small className={s.marcador}>Seu retrato</small>
      <h2>Descubra como você se vê e como te veem.</h2>
      <p>Responda 12 perguntas sobre você para ver o seu perfil. Depois, quem você convidar diz como te enxerga. Com 3 respostas, aparece o seu retrato e o quanto ele está nítido.</p>
      <div className={s.chips}><Link prefetch={false} className={s.btnP} href="/comecar">Fazer o Retrato</Link></div>
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

      {d.apareceram.length > 0 ? (
        <section className={s.item} style={{ borderColor: "var(--people)" }}>
          <b>Algo que você guarda começou a aparecer</b>
          <p className={s.muted} style={{ margin: "4px 0 0" }}>
            {d.apareceram.map((t) => TRACOS[t].nome).join(", ")}: {d.apareceram.length === 1 ? "você marcou como algo que não mostra, mas" : "você marcou como coisas que não mostra, mas"} quem te responde já está te enxergando assim mesmo sem você contar.
          </p>
        </section>
      ) : null}

      <section className={s.item}>
        <div className={s.itemCab}><b>O que você guarda só para você</b></div>
        <p className={s.muted} style={{ margin: "0 0 10px" }}>Marque um traço que você sabe de si, mas não costuma mostrar. Isso é só seu — ninguém mais vê, e não entra na comparação nem na nitidez.</p>
        <div className={s.chips}>
          {ORDEM_TRACOS.map((t) => {
            const ativo = d.ocultos.includes(t);
            return (
              <button key={t} type="button" className={s.chip} aria-pressed={ativo}
                style={ativo ? { borderColor: "var(--people)", background: "rgb(76 141 255 / .16)" } : undefined}
                onClick={() => void alternarOculto(t)}>
                {ativo ? "🔒 " : ""}{TRACOS[t].nome}
              </button>
            );
          })}
        </div>
      </section>

      {d.eles && d.selo ? (
        <>
          <Nitidez selo={d.selo} />
          {linha && linha.length >= 2 ? (
            <section className={s.item}>
              <div className={s.itemCab}><b>Sua evolução</b><span className={s.muted}>desde {new Date(linha[0]!.em).toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}</span></div>
              <div className={s.linhaTempo}>
                {linha.map((m, k) => (
                  <div key={m.em} className={s.marco}>
                    <span className={s.marcoPonto} style={{ background: m.nivel ? COR_NITIDEZ : COR_SEM_NIVEL }} />
                    <div>
                      <b>{m.nivel ? `Retrato ${NIVEL_NOME[m.nivel]}` : "Retrato de contrastes"}</b>
                      <span className={s.muted}> · {new Date(m.em).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })} · {m.respondentes} {m.respondentes === 1 ? "pessoa" : "pessoas"}</span>
                      {k > 0 ? <small className={s.muted} style={{ display: "block" }}>{m.batem > linha[k - 1]!.batem ? "Ficou mais parecido com quem te conhece." : "Ficou mais diferente de quem te conhece."}</small> : null}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
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
            <b>Nitidez por relação</b>
            {d.relacoes.map((r) => (
              <div key={r.relacao} className={s.linha}>
                <span className={`${s.rel} ${s[`rel_${r.relacao}`]}`}>{ROTULO_RELACAO[r.relacao]}</span>
                <span className={s.nome}>{r.selo ? (r.selo.titulo ?? "Te veem diferente") : `${r.respondentes} de 3 pessoas`}</span>
                {r.selo ? <strong>{r.selo.batem}/6</strong> : <Link prefetch={false} className={s.btnFio} href={`/comecar?rel=${r.relacao}`}>Convidar</Link>}
              </div>
            ))}
          </section>
        </>
      ) : (
        <section className={s.item}>
          <b>Como te veem</b>
          <div className={s.progressoRetrato} aria-label={`${d.respondentes} de 3 pessoas`}>{[0, 1, 2].map((k) => <i key={k} className={k < d.respondentes ? s.ok : ""} />)}</div>
          <p className={s.muted} style={{ margin: 0 }}>Faltam {d.faltam} {d.faltam === 1 ? "pessoa" : "pessoas"} para aparecer como te enxergam e descobrir o quanto o seu retrato está nítido. Para proteger quem responde, só mostramos com pelo menos 3.</p>
          <div className={s.chips}><Link prefetch={false} className={s.btnP} href="/comecar">Convidar mais gente</Link></div>
        </section>
      )}
    </>
  );
}

"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/client/api";
import { ROTULO_CATEGORIA, fraseEstado, quandoRevela, type Rodada } from "../../lib/client/mundo";
import { Avatar } from "../app/AppShell";
import s from "./rede.module.css";

type Pessoa = {
  id: string; nome: string; conversas: number; igual: number; diferente: number; semOpiniao: number; pendentes: number; ultima: string;
  porCategoria: Record<string, { iguais: number; total: number }>;
  historico: { data: string; categoria: string; evento: string; suaOpiniao: string | null; opiniaoDela: string | null; resultado: "igual" | "diferente" | "sem_opiniao" }[];
};
type Dados = { resumo: { conversas: number; pensaramIgual: number; pendentes: number }; pessoas: Pessoa[]; andamento: Rodada[] };
const CATS = ["economia", "tecnologia", "esporte", "entretenimento"];
const ORDENS = { conexao: "Mais conexão", recentes: "Mais recentes", pendentes: "Mais pendentes" } as const;
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
const sintonia = (p: Pessoa) => (p.igual + p.diferente ? `${p.igual} de ${p.igual + p.diferente}` : "—");

/** Minhas conexões: em que assuntos você e cada pessoa pensam parecido. Sem pontos e sem classificação. */
export function MinhasConexoes() {
  const [d, setD] = useState<Dados | null>(null);
  const [aba, setAba] = useState<"pessoas" | "assuntos" | "andamento">("pessoas");
  const [ordem, setOrdem] = useState<keyof typeof ORDENS>("conexao");
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    apiGet<Dados>("/mundo/conexoes").then((x) => { if (ativo) setD(x); }).catch(() => { if (ativo) setD({ resumo: { conversas: 0, pensaramIgual: 0, pendentes: 0 }, pessoas: [], andamento: [] }); });
    return () => { ativo = false; };
  }, []);

  const pessoas = useMemo(() => {
    const l = [...(d?.pessoas ?? [])];
    const f: Record<keyof typeof ORDENS, (a: Pessoa, b: Pessoa) => number> = {
      conexao: (a, b) => b.igual - a.igual || b.conversas - a.conversas,
      recentes: (a, b) => +new Date(b.ultima) - +new Date(a.ultima),
      pendentes: (a, b) => b.pendentes - a.pendentes,
    };
    return l.sort(f[ordem]);
  }, [d, ordem]);

  if (!d) return <p className={s.muted} aria-busy="true">Reunindo as suas conexões…</p>;
  const maisSintonia = [...d.pessoas].sort((a, b) => b.igual - a.igual)[0];
  const porAssunto = CATS.map((c) => {
    const m = d.pessoas.map((p) => ({ p, v: p.porCategoria[c] })).filter((x) => x.v && x.v.total > 0).sort((a, b) => b.v!.iguais / b.v!.total - a.v!.iguais / a.v!.total || b.v!.total - a.v!.total)[0];
    return m ? { c, nome: m.p.nome } : null;
  }).filter(Boolean) as { c: string; nome: string }[];

  if (d.pessoas.length === 0 && d.andamento.length === 0) return (
    <section className={s.hero}>
      <small className={s.marcador}>Minhas conexões</small>
      <h2>Descubra em que você e as pessoas próximas pensam parecido.</h2>
      <p>Cada evento do Mundo vira uma conversa. Quando o evento terminar, aqui aparece com quem você pensou igual e em quais assuntos.</p>
      <div className={s.chips}><Link className={s.btnP} href="/eventos">Abrir uma conversa no Mundo</Link></div>
    </section>
  );

  return (
    <>
      <section className={s.hero}>
        <small className={s.marcador}>Minhas conexões</small>
        <div className={s.numeros} style={{ flexWrap: "wrap" }}>
          <div><strong>{d.resumo.conversas}</strong><span>conversas concluídas</span></div>
          <div><strong>{d.resumo.pensaramIgual}</strong><span>vezes em que pensaram igual</span></div>
          <div><strong>{d.resumo.pendentes}</strong><span>em aberto</span></div>
        </div>
        <div className={s.blocosPlacar}>
          <div><small>Quem mais pensa como você</small><b>{maisSintonia && maisSintonia.igual ? `${maisSintonia.nome} · ${sintonia(maisSintonia)}` : "Ainda ninguém"}</b></div>
          <div><small>Pessoas na sua rede</small><b>{d.pessoas.length}</b></div>
          <div><small>Acontecendo agora</small><b>{d.resumo.pendentes} {d.resumo.pendentes === 1 ? "conversa esperando" : "conversas esperando"}</b></div>
        </div>
      </section>

      <div className={s.abas} role="tablist" aria-label="Minhas conexões" style={{ margin: "0 0 14px" }}>
        <button role="tab" type="button" aria-selected={aba === "pessoas"} onClick={() => setAba("pessoas")}>Pessoas</button>
        <button role="tab" type="button" aria-selected={aba === "assuntos"} onClick={() => setAba("assuntos")}>Assuntos</button>
        <button role="tab" type="button" aria-selected={aba === "andamento"} onClick={() => setAba("andamento")}>Em aberto ({d.andamento.length})</button>
      </div>

      {aba === "pessoas" ? (
        <>
          <div className={s.rodapeEvento} style={{ marginBottom: 8 }}>
            <span className={s.muted}>Com quem você pensa parecido</span>
            <label className={s.muted}>Ordenar: <select className={s.seletor} value={ordem} onChange={(e) => setOrdem(e.target.value as keyof typeof ORDENS)}>{Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className={s.tabelaCaixa}>
            <table className={s.tabela}>
              <thead><tr><th>Pessoa</th><th>Conversas</th><th>Sintonia</th><th>Pontos de vista diferentes</th><th>Em aberto</th></tr></thead>
              <tbody>
                {pessoas.map((p) => (
                  <Fragment key={p.id}>
                    <tr className={s.linhaClicavel} onClick={() => setAberta(aberta === p.id ? null : p.id)} aria-expanded={aberta === p.id}>
                      <td><span className={s.pessoaCel}><Avatar nome={p.nome} tamanho={30} /><b>{p.nome}</b></span></td>
                      <td>{p.conversas}</td><td className={s.numAcerto}>{sintonia(p)}</td><td>{p.diferente}</td><td>{p.pendentes}</td>
                    </tr>
                    {aberta === p.id ? (
                      <tr><td colSpan={5}>
                        <div className={s.detalhePessoa}>
                          {p.semOpiniao ? <p className={s.muted} style={{ margin: "0 0 8px" }}>{p.semOpiniao} {p.semOpiniao === 1 ? "conversa em que alguém preferiu não opinar não entra" : "conversas em que alguém preferiu não opinar não entram"} na sintonia.</p> : null}
                          {p.historico.length ? (
                            <table className={s.tabela}>
                              <thead><tr><th>Data</th><th>Assunto</th><th>Você</th><th>{p.nome}</th><th></th></tr></thead>
                              <tbody>{p.historico.map((h, k) => (
                                <tr key={k}><td>{data(h.data)}</td><td>{h.evento}<br /><small className={s.muted}>{ROTULO_CATEGORIA[h.categoria]}</small></td><td>{h.suaOpiniao ?? "—"}</td><td>{h.opiniaoDela ?? "Preferiu não opinar"}</td>
                                  <td>{h.resultado === "igual" ? "Pensaram igual" : h.resultado === "diferente" ? "Pensaram diferente" : "—"}</td></tr>
                              ))}</tbody>
                            </table>
                          ) : <p className={s.muted} style={{ margin: "8px 0 0" }}>Nenhuma conversa concluída com {p.nome} ainda.</p>}
                        </div>
                      </td></tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.muted} style={{ marginTop: 10 }}>Este painel mostra como você e cada pessoa pensam sobre os mesmos assuntos. Não classifica ninguém nem diz quem está certo. Conversas canceladas ou em que alguém preferiu não opinar ficam de fora.</p>
        </>
      ) : aba === "assuntos" ? (
        <>
          {porAssunto.length ? <div className={s.item}>{porAssunto.map((m) => <span key={m.c}>Em <b>{ROTULO_CATEGORIA[m.c]}</b>, você pensa mais parecido com <b>{m.nome}</b>.</span>)}</div> : null}
          <div className={s.tabelaCaixa}>
            <table className={s.tabela}>
              <thead><tr><th>Pessoa</th>{CATS.map((c) => <th key={c}>{ROTULO_CATEGORIA[c]}</th>)}</tr></thead>
              <tbody>{pessoas.map((p) => <tr key={p.id}><td><span className={s.pessoaCel}><Avatar nome={p.nome} tamanho={30} /><b>{p.nome}</b></span></td>{CATS.map((c) => <td key={c}>{p.porCategoria[c] ? `${p.porCategoria[c]!.iguais} de ${p.porCategoria[c]!.total}` : "—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className={s.muted} style={{ marginTop: 10 }}>Em quantos assuntos de cada área vocês pensaram igual. Cada área é contada separadamente.</p>
        </>
      ) : (
        d.andamento.length === 0 ? <div className={s.vazio}><strong>Nenhuma conversa em aberto.</strong><Link className={s.btnP} href="/eventos">Abrir uma conversa</Link></div> :
        <div className={s.tabelaCaixa}>
          <table className={s.tabela}>
            <thead><tr><th>Pessoa</th><th>Evento</th><th>Situação</th><th>Revelação</th></tr></thead>
            <tbody>{d.andamento.map((r) => <tr key={r.codigo}><td>{r.lado === "criador" ? r.convidado ?? "Convite enviado" : r.criador}</td><td>{r.evento.titulo}</td><td>{fraseEstado(r)}</td><td>{quandoRevela(r.evento.encerraEm)}</td></tr>)}</tbody>
          </table>
          <p className={s.muted} style={{ margin: "10px 0 0" }}>As conversas em aberto entram aqui quando o evento terminar.</p>
        </div>
      )}
    </>
  );
}

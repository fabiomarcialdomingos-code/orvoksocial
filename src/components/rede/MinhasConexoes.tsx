"use client";
import Link from "next/link";
import { Fragment, useEffect, useMemo, useState } from "react";
import { apiGet } from "../../lib/client/api";
import { ROTULO_CATEGORIA, fraseEstado, quandoRevela, type Rodada } from "../../lib/client/mundo";
import { Avatar } from "../app/AppShell";
import s from "./rede.module.css";

type Conta = { acertos: number; erros: number; naoSei: number };
type Pessoa = {
  id: string; nome: string; rodadas: number; sobreVoce: Conta; voceSobre: Conta; pendentes: number; ultima: string; aproveitamento: number | null;
  porCategoria: Record<string, { acertos: number; total: number }>; sequencia: number;
  historico: { data: string; categoria: string; evento: string; quemRespondeu: string; resposta: string | null; palpite: string | null; resultado: "acertou" | "errou" | "nao_sei"; direcao: "sobre_voce" | "voce_sobre" }[];
};
type Dados = { resumo: { concluidas: number; previsoesRecebidas: number; acertosSobreVoce: number; pendentes: number }; pessoas: Pessoa[]; andamento: Rodada[] };
const CATS = ["economia", "tecnologia", "esporte", "entretenimento"];
const ORDENS = { acertos: "Mais acertos", rodadas: "Mais rodadas", recentes: "Mais recentes", sequencia: "Maior sequência", pendentes: "Mais pendentes" } as const;
const pct = (c: Conta) => { const t = c.acertos + c.erros; return t ? `${Math.round((c.acertos / t) * 1000) / 10}%`.replace(".", ",") : "—"; };
const data = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });

/** Meu placar: cada evento é uma partida, cada pessoa uma temporada. */
export function MeuPlacar() {
  const [d, setD] = useState<Dados | null>(null);
  const [aba, setAba] = useState<"placar" | "categorias" | "andamento">("placar");
  const [ordem, setOrdem] = useState<keyof typeof ORDENS>("acertos");
  const [aberta, setAberta] = useState<string | null>(null);
  useEffect(() => {
    let ativo = true;
    apiGet<Dados>("/mundo/placar").then((x) => { if (ativo) setD(x); }).catch(() => { if (ativo) setD({ resumo: { concluidas: 0, previsoesRecebidas: 0, acertosSobreVoce: 0, pendentes: 0 }, pessoas: [], andamento: [] }); });
    return () => { ativo = false; };
  }, []);

  const pessoas = useMemo(() => {
    const l = [...(d?.pessoas ?? [])];
    const f: Record<keyof typeof ORDENS, (a: Pessoa, b: Pessoa) => number> = {
      acertos: (a, b) => b.sobreVoce.acertos - a.sobreVoce.acertos, rodadas: (a, b) => b.rodadas - a.rodadas,
      recentes: (a, b) => +new Date(b.ultima) - +new Date(a.ultima), sequencia: (a, b) => b.sequencia - a.sequencia, pendentes: (a, b) => b.pendentes - a.pendentes,
    };
    return l.sort(f[ordem]);
  }, [d, ordem]);

  if (!d) return <p className={s.muted} aria-busy="true">Montando seu placar…</p>;
  const topVoce = [...d.pessoas].sort((a, b) => b.sobreVoce.acertos - a.sobreVoce.acertos)[0];
  const topEles = [...d.pessoas].sort((a, b) => b.voceSobre.acertos - a.voceSobre.acertos)[0];
  const melhorPorCat = CATS.map((c) => {
    const m = d.pessoas.map((p) => ({ p, v: p.porCategoria[c] })).filter((x) => x.v && x.v.total > 0).sort((a, b) => b.v!.acertos / b.v!.total - a.v!.acertos / a.v!.total || b.v!.total - a.v!.total)[0];
    return m ? { c, nome: m.p.nome } : null;
  }).filter(Boolean) as { c: string; nome: string }[];

  if (d.pessoas.length === 0 && d.andamento.length === 0) return (
    <section className={s.hero}>
      <small className={s.marcador}>Meu placar</small>
      <h2>Acompanhe como as pessoas preveem você.</h2>
      <p>Cada evento do Mundo vira uma partida. Quando as rodadas forem reveladas, aqui aparece quem mais acertou você, quem você mais acertou e em quais assuntos.</p>
      <div className={s.chips}><Link className={s.btnP} href="/eventos">Criar uma rodada no Mundo</Link></div>
    </section>
  );

  return (
    <>
      <section className={s.hero}>
        <small className={s.marcador}>Meu placar</small>
        <div className={s.numeros} style={{ flexWrap: "wrap" }}>
          <div><strong>{d.resumo.concluidas}</strong><span>rodadas concluídas</span></div>
          <div><strong>{d.resumo.previsoesRecebidas}</strong><span>previsões sobre você</span></div>
          <div><strong>{d.resumo.acertosSobreVoce}</strong><span>acertos sobre você</span></div>
          <div><strong>{d.resumo.pendentes}</strong><span>pendentes</span></div>
        </div>
        <div className={s.blocosPlacar}>
          <div><small>Quem mais acertou você</small><b>{topVoce && topVoce.sobreVoce.acertos ? `${topVoce.nome} · ${topVoce.sobreVoce.acertos} de ${topVoce.sobreVoce.acertos + topVoce.sobreVoce.erros}` : "Ainda ninguém"}</b></div>
          <div><small>Quem você mais acertou</small><b>{topEles && topEles.voceSobre.acertos ? `${topEles.nome} · ${topEles.voceSobre.acertos} de ${topEles.voceSobre.acertos + topEles.voceSobre.erros}` : "Ainda ninguém"}</b></div>
          <div><small>Acontecendo agora</small><b>{d.resumo.pendentes} {d.resumo.pendentes === 1 ? "rodada esperando" : "rodadas esperando"}</b></div>
        </div>
      </section>

      <div className={s.abas} role="tablist" aria-label="Meu placar" style={{ margin: "0 0 14px" }}>
        <button role="tab" type="button" aria-selected={aba === "placar"} onClick={() => setAba("placar")}>Placar</button>
        <button role="tab" type="button" aria-selected={aba === "categorias"} onClick={() => setAba("categorias")}>Categorias</button>
        <button role="tab" type="button" aria-selected={aba === "andamento"} onClick={() => setAba("andamento")}>Em andamento ({d.andamento.length})</button>
      </div>

      {aba === "placar" ? (
        <>
          <div className={s.rodapeEvento} style={{ marginBottom: 8 }}>
            <span className={s.muted}>Como as pessoas se saem ao tentar prever você</span>
            <label className={s.muted}>Ordenar: <select className={s.seletor} value={ordem} onChange={(e) => setOrdem(e.target.value as keyof typeof ORDENS)}>{Object.entries(ORDENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          </div>
          <div className={s.tabelaCaixa}>
            <table className={s.tabela}>
              <thead><tr><th>Pessoa</th><th>Rodadas</th><th>Acertos</th><th>Erros</th><th>Aproveit.</th><th>Pendentes</th></tr></thead>
              <tbody>
                {pessoas.map((p) => (
                  <Fragment key={p.id}>
                    <tr className={s.linhaClicavel} onClick={() => setAberta(aberta === p.id ? null : p.id)} aria-expanded={aberta === p.id}>
                      <td><span className={s.pessoaCel}><Avatar nome={p.nome} tamanho={30} /><b>{p.nome}</b>{p.rodadas < 3 ? <small className={s.muted}>poucas rodadas</small> : null}</span></td>
                      <td>{p.rodadas}</td><td className={s.numAcerto}>{p.sobreVoce.acertos}</td><td>{p.sobreVoce.erros}</td><td>{pct(p.sobreVoce)}</td><td>{p.pendentes}</td>
                    </tr>
                    {aberta === p.id ? (
                      <tr><td colSpan={6}>
                        <div className={s.detalhePessoa}>
                          <div className={s.duasDirecoes}>
                            <div><small>{p.nome} sobre você</small><b>{p.sobreVoce.acertos} de {p.sobreVoce.acertos + p.sobreVoce.erros}</b><span>{pct(p.sobreVoce)}{p.sobreVoce.naoSei ? ` · ${p.sobreVoce.naoSei} sem arriscar` : ""}</span></div>
                            <div><small>Você sobre {p.nome}</small><b>{p.voceSobre.acertos} de {p.voceSobre.acertos + p.voceSobre.erros}</b><span>{pct(p.voceSobre)}{p.voceSobre.naoSei ? ` · ${p.voceSobre.naoSei} sem arriscar` : ""}</span></div>
                          </div>
                          {p.sequencia >= 2 ? <p className={s.muted} style={{ margin: "8px 0 0" }}>{p.nome} está há {p.sequencia} rodadas acertando suas respostas.</p> : null}
                          {p.historico.length ? (
                            <table className={s.tabela} style={{ marginTop: 10 }}>
                              <thead><tr><th>Data</th><th>Evento</th><th>Quem respondeu</th><th>Resposta</th><th>Palpite</th><th>Resultado</th></tr></thead>
                              <tbody>{p.historico.map((h, k) => (
                                <tr key={k}><td>{data(h.data)}</td><td>{h.evento}<br /><small className={s.muted}>{ROTULO_CATEGORIA[h.categoria]}</small></td><td>{h.quemRespondeu}</td><td>{h.resposta}</td><td>{h.palpite ?? "Não sei"}</td>
                                  <td>{h.resultado === "nao_sei" ? "Sem pontuação" : `${h.direcao === "sobre_voce" ? p.nome : "Você"} ${h.resultado === "acertou" ? "acertou" : "errou"}`}</td></tr>
                              ))}</tbody>
                            </table>
                          ) : <p className={s.muted} style={{ margin: "8px 0 0" }}>Nenhuma rodada revelada ainda com {p.nome}.</p>}
                        </div>
                      </td></tr>
                    ) : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className={s.muted} style={{ marginTop: 10 }}>O placar mostra o desempenho nestas rodadas. Não define o valor de ninguém nem prova quem te conhece em tudo. &ldquo;Não sei&rdquo; e eventos cancelados não pontuam. Classificação mais justa a partir de 3 rodadas.</p>
        </>
      ) : aba === "categorias" ? (
        <>
          {melhorPorCat.length ? <div className={s.item}>{melhorPorCat.map((m) => <span key={m.c}><b>{m.nome}</b> prevê melhor suas opiniões sobre <b>{ROTULO_CATEGORIA[m.c]}</b>.</span>)}</div> : null}
          <div className={s.tabelaCaixa}>
            <table className={s.tabela}>
              <thead><tr><th>Pessoa</th>{CATS.map((c) => <th key={c}>{ROTULO_CATEGORIA[c]}</th>)}</tr></thead>
              <tbody>{pessoas.map((p) => <tr key={p.id}><td><span className={s.pessoaCel}><Avatar nome={p.nome} tamanho={30} /><b>{p.nome}</b></span></td>{CATS.map((c) => <td key={c}>{p.porCategoria[c] ? `${p.porCategoria[c]!.acertos}/${p.porCategoria[c]!.total}` : "—"}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className={s.muted} style={{ marginTop: 10 }}>Acertos de cada pessoa sobre as suas respostas, por assunto. Cada categoria é contada separadamente.</p>
        </>
      ) : (
        d.andamento.length === 0 ? <div className={s.vazio}><strong>Nenhuma rodada esperando.</strong><Link className={s.btnP} href="/eventos">Criar uma rodada</Link></div> :
        <div className={s.tabelaCaixa}>
          <table className={s.tabela}>
            <thead><tr><th>Pessoa</th><th>Evento</th><th>Estado</th><th>Revelação</th></tr></thead>
            <tbody>{d.andamento.map((r) => <tr key={r.codigo}><td>{r.lado === "criador" ? r.convidado ?? "Convite enviado" : r.criador}</td><td>{r.evento.titulo}</td><td>{fraseEstado(r)}</td><td>{quandoRevela(r.evento.encerraEm)}</td></tr>)}</tbody>
          </table>
          <p className={s.muted} style={{ margin: "10px 0 0" }}>Rodadas em andamento ainda não entram no placar.</p>
        </div>
      )}
    </>
  );
}

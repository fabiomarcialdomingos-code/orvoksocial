"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError } from "../../lib/client/api";
import { ROTULO_CATEGORIA, fraseEstado, mensagemConvite, quandoRevela, type Opcao, type Rodada } from "../../lib/client/mundo";
import { IconeRede, useShell } from "../app/AppShell";
import s from "./rede.module.css";

type Evento = { id: string; titulo: string; categoria: string; encerraEm: string; opcoes: Opcao[] };
const CATS = ["todas", "economia", "tecnologia", "esporte", "entretenimento"] as const;

/** Bloco de revelação: resposta, palpite e acerto; o resultado do evento fica separado. */
export function Revelacao({ r }: { r: Rodada }) {
  if (!r.revelacao) return null;
  return (
    <div className={s.revela}>
      <div className={`${s.confirmada} ${s.explode}`} style={r.revelacao.acertou ? undefined : { borderColor: "rgba(255,79,130,.35)", background: "var(--panel-2)" }}>
        <span className={s.selo} style={r.revelacao.acertou ? undefined : { background: r.revelacao.naoSei ? "#8E9AB0" : "#FF4F82", boxShadow: "none" }}>{r.revelacao.acertou ? "✓" : r.revelacao.naoSei ? "?" : "✕"}</span>
        <div>
          <b>{fraseEstado(r)}</b>
          <span>{r.quemResponde} respondeu: <b style={{ display: "inline" }}>{r.revelacao.resposta}</b>. {r.revelacao.naoSei ? `${r.quemAdivinha} escolheu "não sei".` : `${r.quemAdivinha} previu: ${r.revelacao.palpite}.`}</span>
        </div>
      </div>
      <p className={s.muted} style={{ margin: "8px 2px 0" }}>Resultado do evento: {r.evento.resultado ?? "ainda não informado"}. Acertar a resposta da pessoa é diferente de acertar o resultado do evento.</p>
    </div>
  );
}

/** Mundo entre pessoas: o evento é o assunto; o jogo é adivinhar a resposta de alguém. */
export function MundoPessoas() {
  const { toast, profile } = useShell();
  const [aba, setAba] = useState<"eventos" | "rodadas">("eventos");
  const [cat, setCat] = useState<(typeof CATS)[number]>("todas");
  const [eventos, setEventos] = useState<Evento[] | null>(null);
  const [rodadas, setRodadas] = useState<Rodada[] | null>(null);
  const [aberto, setAberto] = useState<{ id: string; modo: "ser_previsto" | "prever" } | null>(null);
  const [link, setLink] = useState<{ eventoId: string; codigo: string; modo: "ser_previsto" | "prever"; titulo: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [versao, setVersao] = useState(0);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);
  const nome = (profile?.displayName ?? "Você").trim().split(/\s+/)[0]!;

  useEffect(() => {
    let ativo = true;
    void (async () => {
      const [e, r] = await Promise.all([
        apiGet<{ eventos: Evento[] }>("/mundo/eventos").catch(() => ({ eventos: [] as Evento[] })),
        apiGet<{ rodadas: Rodada[] }>("/mundo/rodadas").catch(() => ({ rodadas: [] as Rodada[] })),
      ]);
      if (ativo) { setEventos(e.eventos); setRodadas(r.rodadas); }
    })();
    return () => { ativo = false; };
  }, [versao]);

  const lista = useMemo(() => (eventos ?? []).filter((e) => cat === "todas" || e.categoria === cat), [eventos, cat]);
  const pendentes = (rodadas ?? []).filter((r) => r.minhaVez).length;

  const criar = async (e: Evento, modo: "ser_previsto" | "prever", resposta?: string) => {
    setOcupado(true);
    try {
      const r = await apiPost<{ codigo: string }>("/mundo/rodadas", { eventoId: e.id, modo, nome, ...(resposta ? { resposta } : {}) });
      setLink({ eventoId: e.id, codigo: r.codigo, modo, titulo: e.titulo }); setAberto(null); recarregar();
    } catch (err) { toast(describeError(err), "error"); } finally { setOcupado(false); }
  };
  const enviar = async (canal: "whatsapp" | "copiar", l: { codigo: string; modo: "ser_previsto" | "prever"; titulo: string }) => {
    const url = `${window.location.origin}/m/${l.codigo}`, texto = mensagemConvite({ modo: l.modo, titulo: l.titulo }, url);
    if (canal === "whatsapp") window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    else { await navigator.clipboard?.writeText(texto).catch(() => undefined); toast("Convite copiado. É só colar no WhatsApp."); }
    void apiPost("/medicao", { passo: "convite_enviado", codigo: l.codigo }).catch(() => undefined);
  };
  const palpitar = async (r: Rodada, opcao: string | null) => {
    try { await apiPost(`/mundo/rodadas/${r.codigo}/palpite`, { opcao }); toast("Palpite registrado. O resultado sai depois do evento."); recarregar(); }
    catch (err) { toast(describeError(err), "error"); }
  };

  return (
    <>
      <div className={s.abas} role="tablist" aria-label="Mundo">
        <button role="tab" type="button" aria-selected={aba === "eventos"} onClick={() => setAba("eventos")}>Eventos da semana</button>
        <button role="tab" type="button" aria-selected={aba === "rodadas"} onClick={() => setAba("rodadas")}>Minhas rodadas{pendentes ? ` (${pendentes})` : ""}</button>
      </div>

      {aba === "eventos" ? (
        <>
          <section className={s.hero}>
            <small className={s.marcador}>O mundo é só o assunto</small>
            <h2>Você consegue adivinhar o que seus amigos pensam?</h2>
            <p>Escolha um evento. Responda em segredo e veja se alguém te prevê, ou tente adivinhar a opinião de alguém. Tudo é revelado depois que o evento termina.</p>
            <div className={s.chips} role="group" aria-label="Categorias">
              {CATS.map((c) => <button key={c} type="button" className={s.chip} aria-pressed={cat === c} onClick={() => setCat(c)} style={cat === c ? { borderColor: "var(--people)", background: "rgb(76 141 255 / .16)" } : undefined}>{c === "todas" ? "Todas" : ROTULO_CATEGORIA[c]}</button>)}
            </div>
          </section>
          {!eventos ? <p className={s.muted} aria-busy="true">Carregando…</p> : lista.length === 0 ? (
            <div className={s.vazio}><strong>Nenhum evento aberto nesta categoria.</strong><span>Novos eventos aparecem aqui toda semana.</span></div>
          ) : lista.map((e) => (
            <article key={e.id} className={`${s.evento} ${aberto?.id === e.id || link?.eventoId === e.id ? s.eventoAtivo : ""}`}>
              <div className={s.rodapeEvento}><span className={s.cat}>{ROTULO_CATEGORIA[e.categoria] ?? e.categoria}</span><span className={s.muted}>revelação {quandoRevela(e.encerraEm)}</span></div>
              <h3>{e.titulo}</h3>
              {link?.eventoId === e.id ? (
                <div className={s.revela}>
                  <div className={s.confirmada}><span className={s.selo}>✓</span><div><b>{link.modo === "ser_previsto" ? "Sua resposta está guardada em segredo" : "Rodada criada"}</b><span>{link.modo === "ser_previsto" ? "Agora mande para alguém tentar adivinhar." : "Mande para a pessoa responder. Depois você tenta adivinhar."}</span></div></div>
                  <div className={s.chips} style={{ marginTop: 10 }}>
                    <button className={s.btnP} type="button" onClick={() => void enviar("whatsapp", link)}>Enviar no WhatsApp</button>
                    <button className={s.btnFio} type="button" onClick={() => void enviar("copiar", link)}>Copiar convite</button>
                    <button className={s.btnFio} type="button" onClick={() => setLink(null)}>Fechar</button>
                  </div>
                </div>
              ) : aberto?.id === e.id && aberto.modo === "ser_previsto" ? (
                <div className={s.revela}>
                  <p className={s.muted} style={{ margin: "0 0 8px" }}>Responda em segredo. Ninguém vê antes do evento terminar.</p>
                  <div className={s.opcoes}>{e.opcoes.map((o) => <button key={o.id} type="button" className={s.opcao} disabled={ocupado} onClick={() => void criar(e, "ser_previsto", o.id)}><span>{o.rotulo}</span></button>)}</div>
                  <button className={s.linkSutil} type="button" onClick={() => setAberto(null)}>Cancelar</button>
                </div>
              ) : (
                <div className={s.chips}>
                  <button className={s.btnP} type="button" onClick={() => setAberto({ id: e.id, modo: "ser_previsto" })}><IconeRede nome="alvo" />&nbsp;Quero ser previsto</button>
                  <button className={s.btnFio} type="button" disabled={ocupado} onClick={() => void criar(e, "prever")}><IconeRede nome="pessoas" />&nbsp;Quero prever alguém</button>
                </div>
              )}
            </article>
          ))}
        </>
      ) : (
        !rodadas ? <p className={s.muted} aria-busy="true">Carregando…</p> : rodadas.length === 0 ? (
          <div className={s.vazio}><strong>Nenhuma rodada ainda.</strong><span>Escolha um evento da semana e convide alguém.</span><button className={s.btnP} type="button" onClick={() => setAba("eventos")}>Ver eventos</button></div>
        ) : rodadas.map((r) => (
          <article key={r.codigo} className={`${s.evento} ${r.minhaVez ? s.eventoAtivo : ""}`}>
            <div className={s.rodapeEvento}><span className={s.cat}>{ROTULO_CATEGORIA[r.evento.categoria] ?? r.evento.categoria}</span><span className={s.muted}>{r.lado === "criador" ? (r.convidado ? `com ${r.convidado}` : "convite enviado") : `com ${r.criador}`}</span></div>
            <h3>{r.evento.titulo}</h3>
            {r.estado === "revelada" ? <Revelacao r={r} /> : <p className={s.muted} style={{ margin: 0 }}>{fraseEstado(r)}{r.minhaResposta ? `. Sua resposta: ${r.minhaResposta}` : ""}{r.meuPalpite ? `. Seu palpite: ${r.meuPalpite}` : ""}</p>}
            {r.minhaVez && r.lado === "criador" ? (
              <div className={s.revela}>
                <p className={s.muted} style={{ margin: "0 0 8px" }}>O que você acha que {r.convidado} respondeu?</p>
                <div className={s.opcoes}>
                  {r.evento.opcoes.map((o) => <button key={o.id} type="button" className={s.opcao} onClick={() => void palpitar(r, o.id)}><span>{o.rotulo}</span></button>)}
                  <button type="button" className={s.opcao} onClick={() => void palpitar(r, null)}><span>Não sei</span></button>
                </div>
              </div>
            ) : null}
            {r.lado === "criador" && r.estado === "aguardando_convidado" ? (
              <div className={s.chips}><button className={s.btnFio} type="button" onClick={() => void enviar("whatsapp", { codigo: r.codigo, modo: r.modo, titulo: r.evento.titulo })}>Enviar de novo</button></div>
            ) : null}
          </article>
        ))
      )}
    </>
  );
}

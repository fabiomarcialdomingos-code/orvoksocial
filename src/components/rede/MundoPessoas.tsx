"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError } from "../../lib/client/api";
import { ROTULO_CATEGORIA, fraseEstado, mensagemConvite, quandoRevela, type Opcao, type Rodada } from "../../lib/client/mundo";
import { IconeRede, useShell } from "../app/AppShell";
import s from "./rede.module.css";

type Evento = { id: string; titulo: string; categoria: string; encerraEm: string; opcoes: Opcao[] };
const CATS = ["todas", "economia", "tecnologia", "esporte", "entretenimento"] as const;

/** Bloco de revelação: as duas opiniões lado a lado; o resultado do evento fica separado. */
export function Revelacao({ r }: { r: Rodada }) {
  if (!r.revelacao) return null;
  const v = r.revelacao;
  return (
    <div className={s.revela}>
      <div className={`${s.confirmada} ${s.explode}`} style={v.igual ? undefined : { borderColor: "var(--line-strong)", background: "var(--panel-2)" }}>
        <span className={s.selo} style={v.igual ? undefined : { background: "#8E9AB0", boxShadow: "none" }}>{v.igual ? "=" : v.semOpiniao ? "–" : "≠"}</span>
        <div>
          <b>{fraseEstado(r)}</b>
          <span>{r.primeiro} acha: <b style={{ display: "inline" }}>{v.primeiraOpiniao}</b>. {v.semOpiniao ? `${r.segundo} preferiu não opinar.` : `${r.segundo} acha: ${v.segundaOpiniao}.`}</span>
        </div>
      </div>
      <p className={s.muted} style={{ margin: "8px 2px 0" }}>Resultado do evento: {r.evento.resultado ?? "ainda não informado"}. Pensar igual a alguém é diferente de quem estava certo sobre o evento.</p>
    </div>
  );
}

/** Mundo entre pessoas: o evento é o assunto; cada um diz o que acha e, depois, vocês descobrem se pensaram igual. */
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
  const opinar = async (r: Rodada, opcao: string | null) => {
    try { await apiPost(`/mundo/rodadas/${r.codigo}/opiniao`, { opcao }); toast("Opinião registrada. Vocês descobrem depois do evento."); recarregar(); }
    catch (err) { toast(describeError(err), "error"); }
  };

  return (
    <>
      <div className={s.abas} role="tablist" aria-label="Mundo">
        <button role="tab" type="button" aria-selected={aba === "eventos"} onClick={() => setAba("eventos")}>Eventos da semana</button>
        <button role="tab" type="button" aria-selected={aba === "rodadas"} onClick={() => setAba("rodadas")}>Minhas conversas{pendentes ? ` (${pendentes})` : ""}</button>
      </div>

      {aba === "eventos" ? (
        <>
          <section className={s.hero}>
            <small className={s.marcador}>O mundo é só o assunto</small>
            <h2>O que você acha? E as pessoas que importam?</h2>
            <p>Escolha um evento. Cada um diz, em segredo, o que acha que vai acontecer. Quando o evento terminar, vocês descobrem se pensaram igual.</p>
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
                  <div className={s.confirmada}><span className={s.selo}>✓</span><div><b>{link.modo === "ser_previsto" ? "Sua opinião está guardada em segredo" : "Conversa aberta"}</b><span>{link.modo === "ser_previsto" ? "Agora convide alguém para dizer o que acha." : "Convide a pessoa para responder primeiro. Depois é a sua vez."}</span></div></div>
                  <div className={s.chips} style={{ marginTop: 10 }}>
                    <button className={s.btnP} type="button" onClick={() => void enviar("whatsapp", link)}>Enviar no WhatsApp</button>
                    <button className={s.btnFio} type="button" onClick={() => void enviar("copiar", link)}>Copiar convite</button>
                    <button className={s.btnFio} type="button" onClick={() => setLink(null)}>Fechar</button>
                  </div>
                </div>
              ) : aberto?.id === e.id && aberto.modo === "ser_previsto" ? (
                <div className={s.revela}>
                  <p className={s.muted} style={{ margin: "0 0 8px" }}>O que você acha? Ninguém vê a sua resposta antes do evento terminar.</p>
                  <div className={s.opcoes}>{e.opcoes.map((o) => <button key={o.id} type="button" className={s.opcao} disabled={ocupado} onClick={() => void criar(e, "ser_previsto", o.id)}><span>{o.rotulo}</span></button>)}</div>
                  <button className={s.linkSutil} type="button" onClick={() => setAberto(null)}>Cancelar</button>
                </div>
              ) : (
                <div className={s.chips}>
                  <button className={s.btnP} type="button" onClick={() => setAberto({ id: e.id, modo: "ser_previsto" })}><IconeRede nome="alvo" />&nbsp;Responder primeiro</button>
                  <button className={s.btnFio} type="button" disabled={ocupado} onClick={() => void criar(e, "prever")}><IconeRede nome="pessoas" />&nbsp;Ver se pensamos igual</button>
                </div>
              )}
            </article>
          ))}
        </>
      ) : (
        !rodadas ? <p className={s.muted} aria-busy="true">Carregando…</p> : rodadas.length === 0 ? (
          <div className={s.vazio}><strong>Nenhuma conversa ainda.</strong><span>Escolha um evento da semana e convide alguém.</span><button className={s.btnP} type="button" onClick={() => setAba("eventos")}>Ver eventos</button></div>
        ) : rodadas.map((r) => (
          <article key={r.codigo} className={`${s.evento} ${r.minhaVez ? s.eventoAtivo : ""}`}>
            <div className={s.rodapeEvento}><span className={s.cat}>{ROTULO_CATEGORIA[r.evento.categoria] ?? r.evento.categoria}</span><span className={s.muted}>{r.lado === "criador" ? (r.convidado ? `com ${r.convidado}` : "convite enviado") : `com ${r.criador}`}</span></div>
            <h3>{r.evento.titulo}</h3>
            {r.estado === "revelada" ? <Revelacao r={r} /> : <p className={s.muted} style={{ margin: 0 }}>{fraseEstado(r)}{r.minhaOpiniao ? `. Sua opinião: ${r.minhaOpiniao}` : ""}</p>}
            {r.minhaVez && r.lado === "criador" ? (
              <div className={s.revela}>
                <p className={s.muted} style={{ margin: "0 0 8px" }}>{r.convidado} já respondeu. E você, o que acha?</p>
                <div className={s.opcoes}>
                  {r.evento.opcoes.map((o) => <button key={o.id} type="button" className={s.opcao} onClick={() => void opinar(r, o.id)}><span>{o.rotulo}</span></button>)}
                  <button type="button" className={s.opcao} onClick={() => void opinar(r, null)}><span>Prefiro não opinar</span></button>
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

"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, IconeRede, useShell } from "../app/AppShell";
import { ROTULO_RELACAO, quando, useDesafios } from "./dados";
import s from "./rede.module.css";

/** Desafios da conta: os que a pessoa enviou e os que ela tentou prever. */
export function DesafiosConta() {
  const { toast } = useShell();
  const { dados, recarregar } = useDesafios();
  const [aba, setAba] = useState<"enviados" | "recebidos">("enviados");
  const [confirmar, setConfirmar] = useState<string | null>(null);
  // Abriu Desafios: as respostas até agora deixam de contar como novidade.
  useEffect(() => { try { window.localStorage.setItem("orvok:desafios-visto", String(Date.now())); } catch { /* sem armazenamento local */ } }, []);

  const copiar = async (codigo: string) => {
    await navigator.clipboard?.writeText(`${window.location.origin}/d/${codigo}`).catch(() => undefined);
    toast("Link copiado. É só colar no WhatsApp.");
  };
  const cancelar = async (codigo: string) => {
    const r = await fetch(`/api/v1/desafio/${codigo}/cancelar`, { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" });
    setConfirmar(null);
    if (r.ok) { toast("Convite cancelado. O link parou de funcionar."); recarregar(); } else toast("Não foi possível cancelar agora.", "error");
  };

  return (
    <>
      <div className={s.abas} role="tablist" aria-label="Tipo de desafio">
        <button role="tab" aria-selected={aba === "enviados"} type="button" onClick={() => setAba("enviados")}>Enviados{dados ? ` (${dados.enviados.length})` : ""}</button>
        <button role="tab" aria-selected={aba === "recebidos"} type="button" onClick={() => setAba("recebidos")}>Que eu previ{dados ? ` (${dados.recebidos.length})` : ""}</button>
      </div>

      <section className={s.hero}>
        <h2>Desafie mais alguém</h2>
        <p>Cada relação tem perguntas próprias. Quanto mais gente responder, mais completo fica o seu radar.</p>
        <div className={s.chips}>
          <Link className={s.chip} href="/comecar?rel=familia"><IconeRede nome="casaRel" />Família</Link>
          <Link className={s.chip} href="/comecar?rel=amigos"><IconeRede nome="pessoas" />Amigos</Link>
          <Link className={s.chip} href="/comecar?rel=crush"><IconeRede nome="coracao" />Crush</Link>
        </div>
      </section>

      {!dados ? <p className={s.muted} aria-busy="true">Carregando…</p> : aba === "enviados" ? (
        dados.enviados.length === 0 ? <div className={s.vazio}><strong>Nenhum desafio enviado ainda.</strong><span>Escolha uma relação acima para começar.</span></div> :
        dados.enviados.map((d) => (
          <article key={d.codigo} className={s.item}>
            <div className={s.itemCab}>
              <span className={`${s.rel} ${s[`rel_${d.relacao}`]}`}>{ROTULO_RELACAO[d.relacao]}</span>
              <span className={s.muted}>enviado {quando(d.criadoEm)}</span>
            </div>
            {d.tentativas.length === 0 ? <p className={s.muted} style={{ margin: 0 }}>Ninguém respondeu ainda. Que tal mandar o link de novo?</p> : d.tentativas.map((t) => (
              <div key={t.em} className={s.linha}>
                <Avatar nome={t.nome ?? "?"} tamanho={36} />
                <span className={s.nome}><b>{t.nome ?? "Alguém"}</b> <span className={s.muted}>{quando(t.em)}</span></span>
                <strong>{t.score ?? "?"} de {t.total ?? 10}</strong>
              </div>
            ))}
            <div className={s.chips}>
              <button className={s.btnFio} type="button" onClick={() => void copiar(d.codigo)}>Copiar link</button>
              {confirmar === d.codigo
                ? <><button className={s.btnFio} type="button" onClick={() => void cancelar(d.codigo)}>Sim, cancelar</button><button className={s.btnFio} type="button" onClick={() => setConfirmar(null)}>Manter</button></>
                : <button className={s.btnFio} type="button" onClick={() => setConfirmar(d.codigo)}>Cancelar convite</button>}
            </div>
          </article>
        ))
      ) : (
        dados.recebidos.length === 0 ? <div className={s.vazio}><strong>Você ainda não previu ninguém.</strong><span>Quando alguém te mandar um desafio, ele aparece aqui.</span></div> :
        dados.recebidos.map((r) => (
          <article key={r.codigo} className={s.item}>
            <div className={s.itemCab}><span className={`${s.rel} ${s[`rel_${r.relacao}`]}`}>{ROTULO_RELACAO[r.relacao]}</span><span className={s.muted}>{quando(r.em)}</span></div>
            <div className={s.linha} style={{ borderTop: 0, paddingTop: 0 }}>
              <Avatar nome={r.nome} tamanho={40} />
              <span className={s.nome}>Você acertou sobre <b>{r.nome}</b></span>
              <strong>{r.acertos} de {r.total}</strong>
            </div>
            <div className={s.chips}><Link className={s.btnP} href={`/comecar?volta=${encodeURIComponent(r.nome)}&de=${r.codigo}`}>Desafiar {r.nome} de volta</Link></div>
          </article>
        ))
      )}
    </>
  );
}

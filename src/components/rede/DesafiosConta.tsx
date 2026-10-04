"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Avatar, IconeRede, useShell } from "../app/AppShell";
import { ROTULO_RELACAO, quando, useDesafios } from "./dados";
import s from "./rede.module.css";

/** Convites da conta: os que a pessoa enviou e as visões que ela compartilhou sobre outras pessoas. */
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
      <div className={s.abas} role="tablist" aria-label="Convites">
        <button role="tab" aria-selected={aba === "enviados"} type="button" onClick={() => setAba("enviados")}>Enviados{dados ? ` (${dados.enviados.length})` : ""}</button>
        <button role="tab" aria-selected={aba === "recebidos"} type="button" onClick={() => setAba("recebidos")}>Que eu respondi{dados ? ` (${dados.recebidos.length})` : ""}</button>
      </div>

      <section className={s.hero}>
        <h2>Convide mais alguém</h2>
        <p>Cada relação tem perguntas próprias. Quanto mais pessoas compartilharem como te enxergam, mais completo fica o seu retrato.</p>
        <div className={s.chips}>
          <Link prefetch={false} className={s.chip} href="/comecar?rel=familia"><IconeRede nome="casaRel" />Família</Link>
          <Link prefetch={false} className={s.chip} href="/comecar?rel=amigos"><IconeRede nome="pessoas" />Amigos</Link>
          <Link prefetch={false} className={s.chip} href="/comecar?rel=crush"><IconeRede nome="coracao" />Alguém especial</Link>
        </div>
      </section>

      {!dados ? <p className={s.muted} aria-busy="true">Carregando…</p> : aba === "enviados" ? (
        dados.enviados.length === 0 ? <div className={s.vazio}><strong>Nenhum convite enviado ainda.</strong><span>Escolha uma relação acima para começar.</span></div> :
        dados.enviados.map((d) => (
          <article key={d.codigo} className={s.item}>
            <div className={s.itemCab}>
              <span className={`${s.rel} ${s[`rel_${d.relacao}`]}`}>{ROTULO_RELACAO[d.relacao]}</span>
              <span className={s.muted}>enviado {quando(d.criadoEm)}</span>
            </div>
            <p className={s.muted} style={{ margin: 0 }}>{d.tentativas.length === 0 ? "Ninguém respondeu ainda. Que tal mandar o link de novo?" : `${d.tentativas.length} ${d.tentativas.length === 1 ? "pessoa compartilhou" : "pessoas compartilharam"} como te veem, sem identificação.`} {d.tentativas.length ? <Link className="text-link" href="/retrato">Ver meu retrato</Link> : null}</p>
            <div className={s.chips}>
              <button className={s.btnFio} type="button" onClick={() => void copiar(d.codigo)}>Copiar link</button>
              {confirmar === d.codigo
                ? <><button className={s.btnFio} type="button" onClick={() => void cancelar(d.codigo)}>Sim, cancelar</button><button className={s.btnFio} type="button" onClick={() => setConfirmar(null)}>Manter</button></>
                : <button className={s.btnFio} type="button" onClick={() => setConfirmar(d.codigo)}>Cancelar convite</button>}
            </div>
          </article>
        ))
      ) : (
        dados.recebidos.length === 0 ? <div className={s.vazio}><strong>Você ainda não compartilhou a sua visão sobre ninguém.</strong><span>Quando alguém te enviar um convite, ele aparece aqui.</span></div> :
        dados.recebidos.map((r) => (
          <article key={r.codigo} className={s.item}>
            <div className={s.itemCab}><span className={`${s.rel} ${s[`rel_${r.relacao}`]}`}>{ROTULO_RELACAO[r.relacao]}</span><span className={s.muted}>{quando(r.em)}</span></div>
            <div className={s.linha} style={{ borderTop: 0, paddingTop: 0 }}>
              <Avatar nome={r.nome} tamanho={40} />
              <span className={s.nome}>Você compartilhou como vê <b>{r.nome}</b></span>
            </div>
            <div className={s.chips}><Link prefetch={false} className={s.btnP} href={`/comecar?volta=${encodeURIComponent(r.nome)}&de=${r.codigo}`}>Convidar {r.nome} de volta</Link></div>
          </article>
        ))
      )}
    </>
  );
}

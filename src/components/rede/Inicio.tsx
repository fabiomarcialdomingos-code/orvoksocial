"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, type WorldEvent } from "../../lib/client/api";
import { Avatar, IconeRede, useShell } from "../app/AppShell";
import { ROTULO_RELACAO, quando, useDesafios, type Relacao } from "./dados";
import s from "./rede.module.css";

type Item =
  | { tipo: "visao"; em: string; relacao: Relacao; codigo: string }
  | { tipo: "compartilhou"; em: string; nome: string; relacao: Relacao; codigo: string }
  | { tipo: "mundo"; em: string; evento: WorldEvent };

/** Início logado: o que há de novo entre você e as pessoas que escolheu. Sem publicações abertas nem curtidas. */
export function Inicio() {
  const { profile } = useShell();
  const { dados } = useDesafios();
  const [eventos, setEventos] = useState<WorldEvent[]>([]);

  useEffect(() => {
    let ativo = true;
    void apiGet<{ items: WorldEvent[] }>("/world/events").catch(() => ({ items: [] as WorldEvent[] }))
      .then((w) => { if (ativo) setEventos(w.items.slice(0, 3)); });
    return () => { ativo = false; };
  }, []);

  const itens = useMemo<Item[]>(() => {
    const lista: Item[] = [];
    for (const d of dados?.enviados ?? []) for (const t of d.tentativas) lista.push({ tipo: "visao", em: t.em, relacao: d.relacao, codigo: d.codigo });
    for (const r of dados?.recebidos ?? []) lista.push({ tipo: "compartilhou", em: r.em, nome: r.nome, relacao: r.relacao, codigo: r.codigo });
    for (const e of eventos) lista.push({ tipo: "mundo", em: e.opensAt, evento: e });
    return lista.sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
  }, [dados, eventos]);

  const conhecidos = useMemo(() => {
    const nomes = new Set<string>();
    for (const r of dados?.recebidos ?? []) nomes.add(r.nome);
    return [...nomes];
  }, [dados]);
  const enviados = dados?.enviados.length ?? 0;
  const respostas = (dados?.enviados ?? []).reduce((n, d) => n + d.tentativas.length, 0);
  const nome = profile?.displayName ?? "Você";

  return (
    <>
      <div className={s.stories} aria-label="Pessoas">
        <Link prefetch={false} className={s.story} href="/comecar"><span className={`${s.anel} ${s.anelVoce}`}><Avatar nome={nome} tamanho={58} voce /><span className={s.mais}>+</span></span><b>Você</b></Link>
        {conhecidos.map((n) => <Link key={n} className={s.story} href="/desafios"><span className={s.anel}><Avatar nome={n} tamanho={58} /></span><b>{n}</b></Link>)}
      </div>

      <section className={s.hero} aria-labelledby="t-hero">
        <small className={s.marcador}>{enviados ? "Seus convites" : "Comece por aqui"}</small>
        <h2 id="t-hero">{enviados ? "Como as pessoas te enxergam até agora?" : "Descubra como as pessoas que importam te enxergam."}</h2>
        {enviados ? (
          <div className={s.numeros}>
            <div><strong>{enviados}</strong><span>{enviados === 1 ? "convite enviado" : "convites enviados"}</span></div>
            <div><strong>{respostas}</strong><span>{respostas === 1 ? "visão recebida" : "visões recebidas"}</span></div>
            <div><strong>{dados?.recebidos.length ?? 0}</strong><span>que você compartilhou</span></div>
          </div>
        ) : <p>Responda 12 perguntas sobre você e convide alguém. As perguntas mudam conforme a relação.</p>}
        <ol className={s.caminho} aria-label="Seu caminho no orvok">
          {([["familia", "Família", "casaRel"], ["amigos", "Amigos", "pessoas"], ["crush", "Alguém especial", "coracao"]] as const).map(([rel, rotulo, icone]) => {
            const feito = (dados?.enviados ?? []).some((d) => d.relacao === rel);
            return (
              <li key={rel} className={feito ? s.feito : ""}>
                <Link prefetch={false} href={`/comecar?rel=${rel}`}>
                  <span className={s.check} aria-hidden="true">{feito ? "✓" : <IconeRede nome={icone} />}</span>
                  <span><b>{feito ? `${rotulo}: convite enviado` : `Convide ${rotulo === "Alguém especial" ? "alguém especial" : rotulo === "Família" ? "a família" : "os amigos"}`}</b><small>{feito ? "Mandar para mais alguém" : "Perguntas feitas para essa relação"}</small></span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      {dados && itens.length === 0 ? (
        <div className={s.vazio}><strong>Sua rede começa com um convite.</strong><span>Quando alguém compartilhar como te vê, o aviso aparece aqui.</span><Link prefetch={false} className={s.btnP} href="/comecar">Convidar alguém</Link></div>
      ) : null}

      {itens.map((it) => {
        if (it.tipo === "visao") return (
          <article key={`v-${it.codigo}-${it.em}`} className={s.post}>
            <Avatar nome="?" />
            <div>
              <div className={s.cab}><b>Alguém</b><span>{quando(it.em)}</span></div>
              <p className={s.texto}>Compartilhou como te vê. <span className={`${s.rel} ${s[`rel_${it.relacao}`]}`}>{ROTULO_RELACAO[it.relacao]}</span></p>
              <Link className={s.btnFio} href="/retrato">Ver meu retrato</Link>
            </div>
          </article>
        );
        if (it.tipo === "compartilhou") return (
          <article key={`c-${it.codigo}-${it.em}`} className={s.post}>
            <Avatar nome={nome} voce />
            <div>
              <div className={s.cab}><b>Você</b><span>{quando(it.em)}</span></div>
              <p className={s.texto}>Compartilhou como vê <b>{it.nome}</b>. <span className={`${s.rel} ${s[`rel_${it.relacao}`]}`}>{ROTULO_RELACAO[it.relacao]}</span></p>
              <Link prefetch={false} className={s.btnFio} href={`/comecar?volta=${encodeURIComponent(it.nome)}&de=${it.codigo}`}>Convidar {it.nome} de volta</Link>
            </div>
          </article>
        );
        return (
          <article key={`m-${it.evento.id}`} className={s.post}>
            <span style={{ width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--panel-2)", color: "#7fb2ff" }}><IconeRede nome="globo" /></span>
            <div>
              <div className={s.cab}><b>Mundo</b><span>evento aberto</span></div>
              <p className={s.texto}>{it.evento.title}</p>
              <Link className={s.btnFio} href="/eventos">Ver no Mundo</Link>
            </div>
          </article>
        );
      })}
    </>
  );
}

"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, loadPeople, personName, type Post, type Profile, type WorldEvent } from "../../lib/client/api";
import { Avatar, IconeRede, useShell } from "../app/AppShell";
import { ROTULO_RELACAO, quando, useDesafios, type Relacao } from "./dados";
import { MiniRadar } from "./MiniRadar";
import s from "./rede.module.css";

type Item =
  | { tipo: "resposta"; em: string; nome: string; relacao: Relacao; acertos: number; total: number; codigo: string }
  | { tipo: "recebido"; em: string; nome: string; relacao: Relacao; acertos: number; total: number; codigo: string }
  | { tipo: "post"; em: string; post: Post }
  | { tipo: "mundo"; em: string; evento: WorldEvent };

/** Início logado: a mesma rede da página inicial, com os dados reais da pessoa. */
export function Inicio() {
  const { profile, toast } = useShell();
  const { dados } = useDesafios();
  const [posts, setPosts] = useState<Post[]>([]);
  const [eventos, setEventos] = useState<WorldEvent[]>([]);
  const [pessoas, setPessoas] = useState<Map<string, Profile>>(new Map());
  const [texto, setTexto] = useState("");
  const [curtidos, setCurtidos] = useState<Set<string>>(new Set());

  const [versao, setVersao] = useState(0);
  const carregar = useCallback(() => setVersao((v) => v + 1), []);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const [f, w] = await Promise.all([
        apiGet<{ items: Post[] }>("/social/feed").catch(() => ({ items: [] as Post[] })),
        apiGet<{ items: WorldEvent[] }>("/world/events").catch(() => ({ items: [] as WorldEvent[] })),
      ]);
      const mapa = await loadPeople(f.items.map((p) => p.authorId)).catch(() => new Map<string, Profile>());
      if (!ativo) return;
      setPosts(f.items); setEventos(w.items.slice(0, 3)); setPessoas(new Map(mapa));
    })();
    return () => { ativo = false; };
  }, [versao]);

  const itens = useMemo<Item[]>(() => {
    const lista: Item[] = [];
    for (const d of dados?.enviados ?? []) for (const t of d.tentativas)
      lista.push({ tipo: "resposta", em: t.em, nome: t.nome ?? "Alguém", relacao: d.relacao, acertos: t.score ?? 0, total: t.total ?? 10, codigo: d.codigo });
    for (const r of dados?.recebidos ?? []) lista.push({ tipo: "recebido", em: r.em, nome: r.nome, relacao: r.relacao, acertos: r.acertos, total: r.total, codigo: r.codigo });
    for (const p of posts) lista.push({ tipo: "post", em: p.createdAt, post: p });
    for (const e of eventos) lista.push({ tipo: "mundo", em: e.opensAt, evento: e });
    return lista.sort((a, b) => new Date(b.em).getTime() - new Date(a.em).getTime());
  }, [dados, posts, eventos]);

  const conhecidos = useMemo(() => {
    const nomes = new Set<string>();
    for (const d of dados?.enviados ?? []) for (const t of d.tentativas) if (t.nome) nomes.add(t.nome);
    for (const r of dados?.recebidos ?? []) nomes.add(r.nome);
    return [...nomes];
  }, [dados]);
  const enviados = dados?.enviados.length ?? 0;
  const respostas = (dados?.enviados ?? []).reduce((n, d) => n + d.tentativas.length, 0);
  const nome = profile?.displayName ?? "Você";

  const publicar = async () => {
    try { await apiPost("/social/posts", { body: texto.trim() }); setTexto(""); carregar(); toast("Publicado."); }
    catch (e) { toast(describeError(e), "error"); }
  };
  const curtir = async (id: string) => {
    if (curtidos.has(id)) return;
    try { await apiPost(`/social/posts/${id}/reactions`, { kind: "insight" }); setCurtidos(new Set(curtidos).add(id)); carregar(); }
    catch (e) { toast(describeError(e), "error"); }
  };

  return (
    <>
      <div className={s.stories} aria-label="Pessoas">
        <Link className={s.story} href="/comecar"><span className={`${s.anel} ${s.anelVoce}`}><Avatar nome={nome} tamanho={58} voce /><span className={s.mais}>+</span></span><b>Você</b></Link>
        {conhecidos.map((n) => <Link key={n} className={s.story} href="/radar"><span className={s.anel}><Avatar nome={n} tamanho={58} /></span><b>{n}</b></Link>)}
      </div>

      <section className={s.hero} aria-labelledby="t-hero">
        <small className={s.marcador}>{enviados ? "Seus desafios" : "Comece por aqui"}</small>
        <h2 id="t-hero">{enviados ? "Quem mais te conhece até agora?" : "Descubra quem te conhece de verdade."}</h2>
        {enviados ? (
          <div className={s.numeros}>
            <div><strong>{enviados}</strong><span>{enviados === 1 ? "desafio enviado" : "desafios enviados"}</span></div>
            <div><strong>{respostas}</strong><span>{respostas === 1 ? "resposta" : "respostas"}</span></div>
            <div><strong>{dados?.recebidos.length ?? 0}</strong><span>que você previu</span></div>
          </div>
        ) : <p>Responda 10 perguntas sobre você e desafie alguém. As perguntas mudam conforme a relação.</p>}
        <ol className={s.caminho} aria-label="Seu caminho no orvok">
          {([["familia", "Família", "casaRel"], ["amigos", "Amigos", "pessoas"], ["crush", "Crush", "coracao"]] as const).map(([rel, rotulo, icone]) => {
            const feito = (dados?.enviados ?? []).some((d) => d.relacao === rel);
            return (
              <li key={rel} className={feito ? s.feito : ""}>
                <Link href={`/comecar?rel=${rel}`}>
                  <span className={s.check} aria-hidden="true">{feito ? "✓" : <IconeRede nome={icone} />}</span>
                  <span><b>{feito ? `${rotulo}: desafio enviado` : `Desafie ${rotulo === "Crush" ? "o crush" : rotulo === "Família" ? "a família" : "os amigos"}`}</b><small>{feito ? "Mandar para mais alguém" : "Perguntas feitas para essa relação"}</small></span>
                </Link>
              </li>
            );
          })}
        </ol>
      </section>

      <div className={s.compor}>
        <Avatar nome={nome} tamanho={44} voce />
        <div style={{ flex: 1 }}>
          <textarea value={texto} maxLength={5000} onChange={(e) => setTexto(e.target.value)} placeholder="O que você anda percebendo sobre as pessoas?" aria-label="Escrever publicação" />
          <div className={s.comporAcoes}><button className={s.btnP} type="button" disabled={!texto.trim()} onClick={() => void publicar()}>Publicar</button></div>
        </div>
      </div>

      {dados && itens.length === 0 ? (
        <div className={s.vazio}><strong>Sua rede começa com um desafio.</strong><span>Quando alguém responder, o placar aparece aqui.</span><Link className={s.btnP} href="/comecar">Desafiar alguém</Link></div>
      ) : null}

      {itens.map((it) => {
        if (it.tipo === "resposta" || it.tipo === "recebido") {
          const titulo = it.tipo === "resposta" ? <><b>{it.nome}</b><span>respondeu o seu desafio</span></> : <><b>Você</b><span>previu {it.nome}</span></>;
          return (
            <article key={`${it.tipo}-${it.codigo}-${it.em}`} className={s.post}>
              <Avatar nome={it.tipo === "resposta" ? it.nome : nome} voce={it.tipo === "recebido"} />
              <div>
                <div className={s.cab}>{titulo}<span>{quando(it.em)}</span></div>
                <div className={s.tipo}><IconeRede nome="radar" />Encontro no radar <span className={`${s.rel} ${s[`rel_${it.relacao}`]}`}>{ROTULO_RELACAO[it.relacao]}</span></div>
                <div className={`${s.cartao} ${s.encontro}`}>
                  <MiniRadar acertos={it.acertos} total={it.total} />
                  <div>
                    <div className={s.placar}>{it.acertos}<small> de {it.total}</small></div>
                    <p className={s.muted} style={{ margin: "4px 0 0" }}>{it.tipo === "resposta" ? `${it.nome} acertou sobre você` : `Você acertou sobre ${it.nome}`}</p>
                    <div className={s.acertos} aria-label={`${it.acertos} acertos de ${it.total}`}>{Array.from({ length: it.total }, (_, i) => <i key={i} className={i < it.acertos ? s.ok : ""} />)}</div>
                  </div>
                </div>
                {it.tipo === "recebido" ? <Link className={s.btnFio} href={`/comecar?volta=${encodeURIComponent(it.nome)}&de=${it.codigo}`}>Desafiar {it.nome} de volta</Link> : null}
              </div>
            </article>
          );
        }
        if (it.tipo === "mundo") return (
          <article key={`m-${it.evento.id}`} className={s.post}>
            <span style={{ width: 44, height: 44, borderRadius: "50%", display: "grid", placeItems: "center", background: "var(--panel-2)", color: "#7fb2ff" }}><IconeRede nome="globo" /></span>
            <div>
              <div className={s.cab}><b>Mundo</b><span>previsão aberta</span></div>
              <p className={s.texto}>{it.evento.title}</p>
              <Link className={s.btnFio} href="/eventos">Fazer minha previsão</Link>
            </div>
          </article>
        );
        const p = it.post, autor = personName(pessoas, p.authorId);
        return (
          <article key={`p-${p.id}`} className={s.post}>
            <Avatar nome={autor} />
            <div>
              <div className={s.cab}><b>{autor}</b><span>{quando(p.createdAt)}</span></div>
              <p className={s.texto}>{p.body}</p>
              <div className={s.acoes}><button type="button" onClick={() => void curtir(p.id)} aria-pressed={curtidos.has(p.id)}><IconeRede nome="coracao" />{p.reactionCount}</button><span>{p.commentCount} comentários</span></div>
            </div>
          </article>
        );
      })}
    </>
  );
}

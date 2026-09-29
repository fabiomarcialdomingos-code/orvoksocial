"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { apiGet, apiPost, describeError, initials, loadPeople, personName, relativeTime, type Group, type Post, type Profile } from "../../lib/client/api";
import { Avatar, IconeRede, useShell } from "./AppShell";
import r from "../rede/rede.module.css";
import { useDesafios } from "../rede/dados";

function Head({ title, text, children }: { title: string; text: string; children?: ReactNode }) {
  return <div className="page-head"><div><h1 className="display">{title}</h1><p>{text}</p></div>{children}</div>;
}

/* ---------- Feed ---------- */
export function Feed() {
  const { toast, profile } = useShell();
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [body, setBody] = useState("");
  const [reacted, setReacted] = useState<Set<string>>(new Set());
  const [openComments, setOpenComments] = useState<string | null>(null);

  const load = useCallback(async () => {
    const r = await apiGet<{ items: Post[] }>("/social/feed");
    setPeople(new Map(await loadPeople(r.items.map((p) => p.authorId))));
    setPosts(r.items);
  }, []);
  useEffect(() => { void load().catch((e) => { toast(describeError(e), "error"); setPosts([]); }); }, [load, toast]);

  const publish = async () => {
    try { await apiPost("/social/posts", { body: body.trim() }); setBody(""); await load(); toast("Publicado."); } catch (e) { toast(describeError(e), "error"); }
  };
  const react = async (id: string) => {
    if (reacted.has(id)) return;
    try { await apiPost(`/social/posts/${id}/reactions`, { kind: "insight" }); setReacted(new Set(reacted).add(id)); await load(); } catch (e) { toast(describeError(e), "error"); }
  };
  const report = async (id: string) => {
    try { await apiPost("/social/reports", { postId: id, reason: "Denúncia enviada pelo feed" }); toast("Denúncia enviada para a moderação."); } catch (e) { toast(describeError(e), "error"); }
  };

  return (
    <>
      <Head title="Feed" text="O que as pessoas estão percebendo sobre si, sobre os outros e sobre o mundo. Posts de grupos aparecem só para quem é membro." />
      <div className="grid-main">
        <section className="card" aria-label="Publicações">
          <form className="post" style={{ paddingTop: 0 }} onSubmit={(e) => { e.preventDefault(); void publish(); }}>
            <span className="avatar">{initials(profile?.displayName)}</span>
            <div className="form-stack">
              <textarea className="input" value={body} onChange={(e) => setBody(e.target.value)} maxLength={5000} placeholder="Uma percepção, uma previsão, uma surpresa…" aria-label="Nova publicação" />
              <div className="row-between"><span className="faint" style={{ fontSize: 13 }}>{body.length}/5000</span><button className="button button-small" disabled={!body.trim()}>Publicar</button></div>
            </div>
          </form>
          {!posts ? <div className="skeleton" style={{ height: 160 }} /> : posts.length === 0 ? (
            <div className="empty"><strong>O feed está silencioso.</strong><span>Seja a primeira pessoa a publicar uma percepção.</span></div>
          ) : posts.map((p) => (
            <article className="post" key={p.id}>
              <span className="avatar" data-p="people">{initials(personName(people, p.authorId))}</span>
              <div>
                <div><strong style={{ fontWeight: 500 }}>{personName(people, p.authorId)}</strong> <span className="faint" style={{ fontSize: 13 }}>{relativeTime(p.createdAt)}</span></div>
                <p className="post-body">{p.body}</p>
                <div className="post-actions">
                  <button aria-pressed={reacted.has(p.id)} onClick={() => void react(p.id)}>Faz sentido · {p.reactionCount}</button>
                  <button onClick={() => setOpenComments(openComments === p.id ? null : p.id)}>Comentários · {p.commentCount}</button>
                  <button onClick={() => void report(p.id)}>Denunciar</button>
                </div>
                {openComments === p.id && <Comments postId={p.id} onChange={load} />}
              </div>
            </article>
          ))}
        </section>
        <aside className="stack">
          <div className="card" data-p="people"><h3>Boas práticas</h3><p className="muted" style={{ marginTop: 8 }}>Fale das suas percepções. Não publique respostas ou previsões de outra pessoa sem que ela concorde.</p></div>
          <div className="card"><h3>Grupos</h3><p className="muted" style={{ marginTop: 8 }}>Para conversar só com quem você escolher.</p><Link className="text-link" href="/grupos" style={{ marginTop: 10 }}>Ver grupos</Link></div>
        </aside>
      </div>
    </>
  );
}

function Comments({ postId, onChange }: { postId: string; onChange: () => Promise<void> }) {
  const { toast } = useShell();
  const [items, setItems] = useState<{ id: string; authorId: string; body: string; createdAt: string }[] | null>(null);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [body, setBody] = useState("");
  const load = useCallback(async () => {
    const r = await apiGet<{ items: { id: string; authorId: string; body: string; createdAt: string }[] }>(`/social/posts/${postId}/comments`);
    setPeople(new Map(await loadPeople(r.items.map((c) => c.authorId))));
    setItems(r.items);
  }, [postId]);
  useEffect(() => { void load().catch(() => setItems([])); }, [load]);
  return (
    <div className="comments">
      {items?.map((c) => <div key={c.id}><strong style={{ fontWeight: 500 }}>{personName(people, c.authorId)}</strong> <span className="muted">{c.body}</span></div>)}
      <form className="row" onSubmit={async (e) => {
        e.preventDefault();
        try { await apiPost(`/social/posts/${postId}/comments`, { body: body.trim() }); setBody(""); await load(); await onChange(); } catch (err) { toast(describeError(err), "error"); }
      }}>
        <input className="input" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Responder…" aria-label="Comentário" maxLength={2000} />
        <button className="button button-small button-secondary" disabled={!body.trim()}>Enviar</button>
      </form>
    </div>
  );
}

/* ---------- Groups ---------- */
export function Groups() {
  const { toast } = useShell();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [invites, setInvites] = useState<{ id: string; groupId: string; inviterId: string; createdAt: string }[]>([]);
  const [people, setPeople] = useState<Map<string, Profile>>(new Map());
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const load = useCallback(async () => {
    const [g, i] = await Promise.all([
      apiGet<{ items: Group[] }>("/social/groups"),
      apiGet<{ items: { id: string; groupId: string; inviterId: string; createdAt: string }[] }>("/social/group-invites"),
    ]);
    setPeople(new Map(await loadPeople(i.items.map((x) => x.inviterId))));
    setGroups(g.items); setInvites(i.items);
  }, []);
  useEffect(() => { void load().catch((e) => { toast(describeError(e), "error"); setGroups([]); }); }, [load, toast]);

  return (
    <>
      <Head title="Grupos" text="Espaços privados para prever junto: a turma da faculdade, a família, o time. Só membros veem o que acontece dentro." />
      {invites.length > 0 && (
        <section className="card" data-p="people" style={{ marginBottom: 16 }}>
          <h2>Convites para grupos</h2>
          <ul className="list">{invites.map((i) => (
            <li key={i.id}><span className="grow">{personName(people, i.inviterId)} te convidou <span className="faint">{relativeTime(i.createdAt)}</span></span>
              <button className="button button-small" data-p="people" onClick={async () => { try { await apiPost(`/social/group-invites/${i.id}/accept`, {}); toast("Você entrou no grupo."); await load(); } catch (e) { toast(describeError(e), "error"); } }}>Entrar</button></li>
          ))}</ul>
        </section>
      )}
      <div className="grid-main">
        <section className="card" aria-label="Seus grupos">
          {!groups ? <div className="skeleton" style={{ height: 140 }} /> : groups.length === 0 ? (
            <div className="empty"><strong>Você ainda não está em nenhum grupo.</strong><span>Crie um e convide pessoas pelo e-mail delas.</span></div>
          ) : <ul className="list">{groups.map((g) => <GroupRow key={g.id} group={g} />)}</ul>}
        </section>
        <form className="card lit form-stack" data-p="people" onSubmit={async (e) => {
          e.preventDefault();
          try { await apiPost("/social/groups", { name: name.trim(), description: description.trim() || undefined }); setName(""); setDescription(""); toast("Grupo criado."); await load(); } catch (err) { toast(describeError(err), "error"); }
        }}>
          <h2>Criar grupo</h2>
          <label className="field"><span>Nome</span><input value={name} onChange={(e) => setName(e.target.value)} required maxLength={160} placeholder="Ex.: Turma do café" /></label>
          <label className="field"><span>Descrição</span><textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={1000} placeholder="Para que serve este grupo?" /></label>
          <div className="form-actions"><button className="button" data-p="people" disabled={!name.trim()}>Criar grupo</button></div>
        </form>
      </div>
    </>
  );
}

function GroupRow({ group }: { group: Group }) {
  const { toast, session } = useShell();
  const [email, setEmail] = useState("");
  const [open, setOpen] = useState(false);
  const invite = async () => {
    try {
      await apiPost(`/social/groups/${group.id}/invites`, { email: email.trim() });
      toast("Convite enviado."); setEmail(""); setOpen(false);
    } catch (e) {
      const text = describeError(e);
      toast(text.startsWith("Não encontramos") ? "Não há conta ativa com esse e-mail." : text, "error");
    }
  };
  return (
    <li style={{ flexWrap: "wrap" }}>
      <span className="avatar" data-p="people">{initials(group.name)}</span>
      <span className="grow"><strong style={{ fontWeight: 500 }}>{group.name}</strong><span className="faint" style={{ display: "block", fontSize: 14 }}>{group.description ?? "Sem descrição"} · {group.ownerId === session.userId ? "você criou" : "membro"}</span></span>
      {group.ownerId === session.userId && <button className="text-link" onClick={() => setOpen(!open)}>{open ? "Fechar" : "Convidar"}</button>}
      {open && (
        <form className="row" style={{ width: "100%" }} onSubmit={(e) => { e.preventDefault(); void invite(); }}>
          <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="E-mail da pessoa" type="email" aria-label="E-mail" />
          <button className="button button-small">Enviar</button>
        </form>
      )}
    </li>
  );
}

/* ---------- Notifications ---------- */
const labels: Record<string, [string, string]> = {
  RADAR_INVITATION_CREATED: ["Novo pedido para prever você", "/desafios"],
  RADAR_INVITED: ["Novo pedido para prever você", "/desafios"],
  RADAR_INVITATION_ACCEPTED: ["Seu pedido foi aceito", "/desafios"],
  RADAR_CONSENT_GRANTED: ["Alguém consentiu ser prevista por você", "/desafios"],
  RADAR_CONSENT_REVOKED: ["Um consentimento foi revogado", "/desafios"],
  RADAR_PREDICTION_CREATED: ["Nova previsão sobre você", "/radar"],
  RADAR_SHARE_LINK_REDEEMED: ["Alguém aceitou o seu convite", "/desafios"],
  GROUP_INVITATION: ["Convite para um grupo", "/grupos"],
};

export function Notifications() {
  const { toast, refreshUnread } = useShell();
  const [items, setItems] = useState<{ id: string; eventType: string; state: string; createdAt: string }[] | null>(null);
  const load = useCallback(async () => {
    const r = await apiGet<{ items: { id: string; eventType: string; state: string; createdAt: string }[] }>("/notifications");
    setItems(r.items.filter((i) => i.state !== "DISMISSED").sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    refreshUnread();
  }, [refreshUnread]);
  useEffect(() => { void load().catch((e) => { toast(describeError(e), "error"); setItems([]); }); }, [load, toast]);
  const act = async (id: string, action: "read" | "dismiss") => {
    try { await apiPost(`/notifications/${id}/${action}`, {}); await load(); } catch (e) { toast(describeError(e), "error"); }
  };
  const { dados } = useDesafios();
  const respostas = (dados?.enviados ?? []).flatMap((d) => d.tentativas.map((t) => ({ nome: t.nome ?? "Alguém", em: t.em, score: t.score, total: t.total, codigo: d.codigo })));
  const lista = [
    ...respostas.map((x) => ({ chave: `d-${x.codigo}-${x.em}`, em: x.em, texto: `${x.nome} respondeu o seu desafio${x.score !== undefined ? ` e acertou ${x.score} de ${x.total}` : ""}`, href: "/desafios", lida: true, id: null as string | null })),
    ...(items ?? []).map((n) => {
      const [text, href] = labels[n.eventType] ?? [n.eventType.toLowerCase().replaceAll("_", " "), "/painel"];
      return { chave: n.id, em: n.createdAt, texto: text, href, lida: n.state !== "UNREAD", id: n.id as string | null };
    }),
  ].sort((a, b) => b.em.localeCompare(a.em));
  return (
    <>
      {!items || !dados ? <p className={r.muted} aria-busy="true">Carregando…</p> : lista.length === 0 ? (
        <div className={r.vazio}><strong>Tudo em dia.</strong><span>Quando alguém responder um desafio seu, o aviso aparece aqui.</span><Link className={r.btnP} href="/comecar">Desafiar alguém</Link></div>
      ) : lista.map((n) => (
        <div key={n.chave} className={`${r.aviso} ${n.lida ? "" : r.naoLido}`}>
          <span className={r.iconeAviso}><IconeRede nome={n.href === "/desafios" ? "alvo" : "sino"} /></span>
          <span><Link href={n.href} onClick={() => { if (!n.lida && n.id) void act(n.id, "read"); }}><b>{n.texto}</b></Link><br /><span className={r.muted}>{relativeTime(n.em)}</span></span>
          {n.id ? <button type="button" className={r.linkSutil} onClick={() => void act(n.id!, "dismiss")}>Dispensar</button> : <span />}
        </div>
      ))}
    </>
  );
}

/* ---------- Profile ---------- */
export function ProfileView({ mathPanel }: { mathPanel?: ReactNode }) {
  const { profile, setProfile, toast } = useShell();
  const [name, setName] = useState(profile?.displayName ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [pending, setPending] = useState(false);
  const { dados } = useDesafios();
  const enviados = dados?.enviados.length ?? 0;
  const respostas = (dados?.enviados ?? []).reduce((n, d) => n + d.tentativas.length, 0);
  return (
    <>
      <section className={r.hero}>
        <div className={r.perfilTopo}>
          <Avatar nome={name || profile?.displayName || "Você"} tamanho={84} voce />
          <div><h2>{name || "Sem nome"}</h2><p>{bio || "Conte em uma frase quem você é."}</p></div>
        </div>
        <div className={r.numeros}>
          <div><strong>{enviados}</strong><span>desafios enviados</span></div>
          <div><strong>{respostas}</strong><span>respostas recebidas</span></div>
          <div><strong>{dados?.recebidos.length ?? 0}</strong><span>pessoas que você previu</span></div>
        </div>
      </section>
      <form className={r.item} onSubmit={async (e) => {
        e.preventDefault(); setPending(true);
        try { const res = await apiPost<{ profile: Profile }>("/social/profile", { displayName: name.trim(), bio: bio.trim() || undefined }); setProfile(res.profile); toast("Perfil salvo."); } catch (err) { toast(describeError(err), "error"); } finally { setPending(false); }
      }}>
        <b>Editar perfil</b>
        <label className={r.campo}>Nome<input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} /></label>
        <label className={r.campo}>Apresentação<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={500} placeholder="Uma frase sobre você" /></label>
        <div><button className={r.btnP} disabled={pending || !name.trim()}>Salvar perfil</button></div>
      </form>
      <section className={r.item}>
        <b>Conta</b>
        <div className={r.listaConta}>
          <Link href="/meus-dados">Privacidade e meus dados <span>›</span></Link>
          <Link href="/recuperar">Trocar senha <span>›</span></Link>
        </div>
      </section>
      {mathPanel}
    </>
  );
}

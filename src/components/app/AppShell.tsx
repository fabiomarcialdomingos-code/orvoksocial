"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, apiPost, type Profile, type Session } from "../../lib/client/api";
import { BrandMark } from "../ui/Brand";
import s from "./rede.module.css";

/**
 * Casca das telas internas, no mesmo desenho da página inicial: menu à esquerda,
 * conteúdo no centro e a rede viva à direita. Mantém o contexto que as telas usam
 * (sessão, perfil, avisos e notificações não lidas).
 */
type Ctx = {
  session: Session;
  profile: Profile | null;
  setProfile: (profile: Profile) => void;
  toast: (text: string, kind?: "ok" | "error") => void;
  unread: number;
  refreshUnread: () => void;
};
const ShellContext = createContext<Ctx | null>(null);
let toastTimer: number | undefined;
export function useShell(): Ctx {
  const value = useContext(ShellContext);
  if (!value) throw new Error("useShell outside AppShell");
  return value;
}

const ICONES = {
  casa: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  alvo: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  radar: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><path d="M12 12 18 6" /></>,
  globo: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" /></>,
  sino: <><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  perfil: <><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4.5 4-7 8-7s7 2.5 8 7" /></>,
  mais: <path d="M12 5v14M5 12h14" />,
  elo: <><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1" /></>,
  espelho: <><circle cx="9" cy="12" r="6" /><circle cx="15" cy="12" r="6" /></>,
  escudo: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /></>,
  sair: <><path d="M15 4h4v16h-4" /><path d="M10 8l-4 4 4 4M6 12h10" /></>,
  casaRel: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z" />,
  pessoas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-4 3.3-6 6.5-6s5.7 2 6.5 6" /><circle cx="17" cy="9" r="2.8" /><path d="M16 14c3 .2 4.8 2.2 5.5 5.5" /></>,
  coracao: <path d="M12 20s-7.5-4.4-9-9.2C2 7.4 4.2 4.5 7.4 4.5c2 0 3.5 1.1 4.6 2.7 1.1-1.6 2.6-2.7 4.6-2.7 3.2 0 5.4 2.9 4.4 6.3-1.5 4.8-9 9.2-9 9.2z" />,
};
export type NomeIcone = keyof typeof ICONES;
export function IconeRede({ nome }: { nome: NomeIcone }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONES[nome]}</svg>;
}

/** Avatar de inicial com o gradiente da identidade (âmbar para você, azul para os outros). */
export function Avatar({ nome, tamanho = 44, voce }: { nome: string; tamanho?: number; voce?: boolean }) {
  return (
    <span className={`${s.avatar} ${voce ? s.avatarVoce : ""}`} style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.4) }} aria-hidden="true">
      {(nome.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

const MENU: { href: string; rotulo: string; icone: NomeIcone; ativo?: string[] }[] = [
  { href: "/painel", rotulo: "Início", icone: "casa", ativo: ["/painel", "/feed"] },
  { href: "/desafios", rotulo: "Convites", icone: "pessoas" },
  { href: "/retrato", rotulo: "Meu retrato", icone: "espelho" },
  { href: "/conexoes", rotulo: "Minhas conexões", icone: "elo" },
  { href: "/eventos", rotulo: "Mundo", icone: "globo" },
  { href: "/notificacoes", rotulo: "Notificações", icone: "sino" },
  { href: "/perfil", rotulo: "Perfil", icone: "perfil", ativo: ["/perfil", "/meus-dados"] },
];

export function AppShell({ title, children, largo, lateral }: { title: string; children: ReactNode; largo?: boolean; lateral?: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toastState, setToastState] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [unread, setUnread] = useState(0);
  const [novas, setNovas] = useState(0);
  const [estanteAtiva, setEstanteAtiva] = useState(false);
  const toast = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setToastState({ text, kind });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToastState(null), 4200);
  }, []);
  useEffect(() => {
    let ativo = true;
    fetch("/api/v1/estante/estado", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { ativa: false })).then((x: { ativa?: boolean }) => { if (ativo) setEstanteAtiva(x.ativa === true); })
      .catch(() => undefined);
    return () => { ativo = false; };
  }, []);
  const refreshUnread = useCallback(() => {
    apiGet<{ items: { state: string }[] }>("/notifications")
      .then((data) => setUnread(data.items.filter((item) => item.state === "UNREAD").length))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    let active = true;
    fetch("/api/v1/auth/session?optional=1", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<Session>) : { authenticated: false }))
      .then(async (data) => {
        if (!active) return;
        if (!data.authenticated) { router.replace(`/entrar?returnTo=${encodeURIComponent(pathname)}`); return; }
        // Perfil antes da sessão: as telas já montam com o nome da pessoa.
        const result = await apiGet<{ profile: Profile | null }>("/social/profile").catch(() => ({ profile: null }));
        if (!active) return;
        setProfile(result.profile);
        setSession(data);
        refreshUnread();
        // Desafios feitos neste aparelho antes do cadastro passam para a conta.
        await fetch("/api/v1/desafio/reivindicar", { method: "POST", headers: { "Content-Type": "application/json" }, body: "{}", credentials: "same-origin" }).catch(() => undefined);
        // Respostas novas desde a última visita a Desafios viram um número no menu.
        const meus = await fetch("/api/v1/desafio/meus", { credentials: "same-origin", cache: "no-store" }).then((x) => (x.ok ? x.json() : { desafios: [] })).catch(() => ({ desafios: [] })) as { desafios: { tentativas: { em: string }[] }[] };
        let visto = 0;
        try { visto = Number(window.localStorage.getItem("orvok:desafios-visto") ?? 0); } catch { visto = 0; }
        if (active && !pathname.startsWith("/desafios")) setNovas(meus.desafios.flatMap((d) => d.tentativas).filter((t) => new Date(t.em).getTime() > visto).length);
      })
      .catch(() => router.replace("/entrar"));
    return () => { active = false; };
  }, [router, pathname, refreshUnread]);

  // Presença ambiente: o ícone do app (instalado na tela inicial) mostra um
  // número com o que está esperando por você, sem precisar abrir nada nem
  // mandar notificação. Funciona enquanto o app está aberto; atualizar o
  // selo com o app fechado pede push, que ainda não temos.
  useEffect(() => {
    if (typeof navigator === "undefined" || !("setAppBadge" in navigator)) return;
    const total = unread + novas;
    const nav = navigator as Navigator & { setAppBadge: (n?: number) => Promise<void>; clearAppBadge: () => Promise<void> };
    void (total > 0 ? nav.setAppBadge(total) : nav.clearAppBadge()).catch(() => undefined);
  }, [unread, novas]);

  const logout = async () => {
    await apiPost("/auth/logout").catch(() => undefined);
    router.replace("/");
    router.refresh();
  };
  const value = useMemo<Ctx | null>(() => (session ? { session, profile, setProfile, toast, unread, refreshUnread } : null),
    [session, profile, toast, unread, refreshUnread]);
  const nome = profile?.displayName ?? "Você";
  const ativo = (item: (typeof MENU)[number]) => (item.ativo ?? [item.href]).some((h) => pathname === h || pathname.startsWith(`${h}/`));

  if (!value) return <div className={s.carregando} aria-busy="true"><span className={s.marcaGrande}><BrandMark size={44} /></span></div>;

  return (
    <ShellContext.Provider value={value}>
      <div className={`${s.shell} ${largo ? s.shellLargo : ""}`}>
        <aside className={s.lateral} aria-label="Navegação principal">
          <Link className={s.marca} href="/painel"><BrandMark size={32} /><span>orvok</span></Link>
          <nav className={s.menu}>
            {(estanteAtiva ? [...MENU.slice(0, 3), { href: "/estante", rotulo: "Minha estante", icone: "elo" as NomeIcone }, ...MENU.slice(3)] : MENU).map((item) => (
              <Link key={item.href} href={item.href} aria-current={ativo(item) ? "page" : undefined}>
                <IconeRede nome={item.icone} /><span>{item.rotulo}</span>
                {item.href === "/notificacoes" && unread > 0 ? <b className={s.bolha}>{unread}</b> : null}
                {item.href === "/desafios" && novas > 0 ? <b className={s.bolha} title="Respostas novas">{novas}</b> : null}
              </Link>
            ))}
            {session?.role === "ADMIN" ? <Link href="/admin" aria-current={pathname.startsWith("/admin") ? "page" : undefined}><IconeRede nome="escudo" /><span>Quartel general</span></Link> : null}
          </nav>
          <Link prefetch={false} className={`${s.btn} ${s.btnAzul} ${s.desafiar}`} href="/comecar"><IconeRede nome="mais" /><span>Convidar alguém</span></Link>
          <div className={s.eu}>
            <Avatar nome={nome} tamanho={40} voce />
            <span className={s.euNome}><b>{nome}</b><small>Sua conta</small></span>
            <button type="button" className={s.sair} onClick={() => void logout()} aria-label="Sair"><IconeRede nome="sair" /></button>
          </div>
        </aside>

        <main className={s.centro} id="conteudo">
          <header className={s.topo}>
            <Link className={s.marcaMovel} href="/painel"><BrandMark size={28} />orvok</Link>
            <h1>{title}</h1>
          </header>
          <div className={s.conteudo}>{children}</div>
        </main>

        {largo ? null : (
          <aside className={s.direita} aria-label="Descobrir">
            {lateral}
            <section className={s.caixa}>
              <h3>Quem vai te enxergar?</h3>
              <p className={s.sub}>Cada relação tem perguntas próprias.</p>
              <div className={s.relacoes}>
                <Link prefetch={false} href="/comecar?rel=familia"><IconeRede nome="casaRel" />Família</Link>
                <Link prefetch={false} href="/comecar?rel=amigos"><IconeRede nome="pessoas" />Amigos</Link>
                <Link prefetch={false} href="/comecar?rel=crush"><IconeRede nome="coracao" />Alguém especial</Link>
              </div>
            </section>
            <nav className={s.rodape} aria-label="Links"><Link href="/privacidade">Privacidade</Link><Link href="/meus-dados">Meus dados</Link><Link href="/perfil">Perfil</Link><span>© orvok 2026</span></nav>
          </aside>
        )}
      </div>

      <nav className={s.abasMovel} aria-label="Navegação">
        {MENU.filter((m) => m.href !== "/notificacoes").slice(0, 2).map((item) => <Link key={item.href} href={item.href} aria-current={ativo(item) ? "page" : undefined} aria-label={item.rotulo}><IconeRede nome={item.icone} /></Link>)}
        <Link prefetch={false} className={s.meio} href="/comecar" aria-label="Convidar alguém"><IconeRede nome="mais" /></Link>
        {[MENU[2]!, MENU[6]!].map((item) => <Link key={item.href} href={item.href} aria-current={ativo(item) ? "page" : undefined} aria-label={item.rotulo}><IconeRede nome={item.icone} /></Link>)}
      </nav>
      {toastState && <div className="toast" role={toastState.kind === "error" ? "alert" : "status"} data-kind={toastState.kind}>{toastState.text}</div>}
    </ShellContext.Provider>
  );
}

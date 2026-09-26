"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { apiGet, apiPost, initials, type Profile, type Session } from "../../lib/client/api";
import { Brand } from "../ui/Brand";

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

type NavItem = { href: string; label: string; p?: "self" | "people" | "world"; keywords?: string };
const primary: NavItem[] = [
  { href: "/painel", label: "Início" },
  { href: "/radar", label: "Radar", p: "people", keywords: "pessoas jornada" },
  { href: "/eventos", label: "Mundo", p: "world", keywords: "eventos previsões" },
  { href: "/feed", label: "Feed", keywords: "comunidade posts" },
];
const groups: { label: string; items: NavItem[] }[] = [
  { label: "Você", items: [{ href: "/onboarding", label: "Meu gabarito", p: "self", keywords: "respostas questionário" }] },
  {
    label: "Pessoas",
    items: [
      { href: "/radar", label: "Radar", p: "people" },
      { href: "/convites", label: "Pedidos", p: "people", keywords: "convites aceitar consentimento" },
      { href: "/previsao", label: "Prever alguém", p: "people", keywords: "previsão" },
      { href: "/resultado", label: "O encontro", p: "people", keywords: "resultado comparação" },
    ],
  },
  { label: "Mundo", items: [{ href: "/eventos", label: "Eventos", p: "world" }] },
  { label: "Comunidade", items: [{ href: "/feed", label: "Feed" }, { href: "/grupos", label: "Grupos" }] },
];

export function AppShell({ title, children }: { title: string; children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [toastState, setToastState] = useState<{ text: string; kind: "ok" | "error" } | null>(null);
  const [palette, setPalette] = useState(false);
  const [unread, setUnread] = useState(0);

  const toast = useCallback((text: string, kind: "ok" | "error" = "ok") => {
    setToastState({ text, kind });
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => setToastState(null), 4200);
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
        if (!data.authenticated) {
          router.replace(`/entrar?returnTo=${encodeURIComponent(pathname)}`);
          return;
        }
        setSession(data);
        const result = await apiGet<{ profile: Profile | null }>("/social/profile").catch(() => ({ profile: null }));
        if (active) setProfile(result.profile);
        refreshUnread();
        // A share link opened before signing up: turn it into a Radar request now.
        let pending: string | null = null;
        try { pending = localStorage.getItem("orvok:convite") ?? sessionStorage.getItem("orvok:convite"); } catch { /* storage off */ }
        if (pending) {
          try { localStorage.removeItem("orvok:convite"); sessionStorage.removeItem("orvok:convite"); } catch { /* ignore */ }
          let hasGuess = false;
          try { hasGuess = Boolean(localStorage.getItem(`orvok:convite-palpite:${pending}`)); } catch { /* storage off */ }
          apiPost<{ ownerId: string; created: boolean }>("/radar/share-links/redeem", { code: pending })
            .then(() => toast(hasGuess
              ? "Desafio aceito. Seu palpite ficou guardado; responda o seu gabarito para poder confirmá-lo assim que a pessoa consentir."
              : "Desafio aceito. Seu pedido foi enviado; responda o seu gabarito enquanto a pessoa consente."))
            .catch(() => undefined);
        }
      })
      .catch(() => router.replace("/entrar"));
    return () => { active = false; };
  }, [router, pathname, refreshUnread, toast]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPalette((open) => !open);
      }
      if (event.key === "Escape") setPalette(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const logout = async () => {
    await apiPost("/auth/logout").catch(() => undefined);
    router.replace("/entrar");
  };

  const value = useMemo<Ctx | null>(() => (session ? { session, profile, setProfile, toast, unread, refreshUnread } : null),
    [session, profile, toast, unread, refreshUnread]);

  const isAdmin = session?.role === "ADMIN" || session?.role === "MODERATOR";
  const current = (href: string) => (pathname === href ? "page" : undefined);
  const name = profile?.displayName ?? "Seu perfil";

  return (
    <div className="shell">
      <aside className="rail" aria-label="Navegação do aplicativo">
        <Brand href="/painel" />
        <div className="rail-group rail-primary rail-mobile-only">
          {primary.map((item) => (
            <Link key={item.href} href={item.href} aria-current={current(item.href)} data-p={item.p}>
              <span className="dot" />{item.label}
            </Link>
          ))}
        </div>
        <div className="rail-group">
          <Link href="/painel" aria-current={current("/painel")}><span className="dot" />Início</Link>
        </div>
        {groups.map((group) => (
          <div className="rail-group" key={group.label}>
            <span className="rail-label">{group.label}</span>
            {group.items.map((item) => (
              <Link key={item.href + item.label} href={item.href} aria-current={current(item.href)} data-p={item.p}>
                <span className="dot" />{item.label}
              </Link>
            ))}
          </div>
        ))}
        <div className="rail-group rail-bottom">
          <Link href="/notificacoes" aria-current={current("/notificacoes")}>
            <span className="dot" />Notificações{unread > 0 && <span className="badge">{unread}</span>}
          </Link>
          <Link href="/perfil" aria-current={current("/perfil")}><span className="dot" />Perfil</Link>
          <Link href="/meus-dados" aria-current={current("/meus-dados")}><span className="dot" />Privacidade e dados</Link>
          {isAdmin && <Link href="/admin" aria-current={current("/admin")}><span className="dot" />Quartel general</Link>}
          <button type="button" className="rail-link" onClick={() => void logout()}><span className="dot" />Sair</button>
        </div>
      </aside>
      <div>
        <header className="topbar">
          <span className="topbar-title"><strong>{title}</strong></span>
          <button type="button" className="command-trigger" onClick={() => setPalette(true)} aria-label="Abrir busca de comandos">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
            <span>Ir para…</span><kbd>Ctrl K</kbd>
          </button>
          <Link href="/perfil" className="avatar" aria-label={`Perfil de ${name}`}>{initials(profile?.displayName)}</Link>
        </header>
        <main id="conteudo" className="page">
          {value ? <ShellContext.Provider value={value}>{children}</ShellContext.Provider> : <ShellSkeleton />}
        </main>
      </div>
      {palette && <Palette isAdmin={isAdmin} onClose={() => setPalette(false)} onLogout={logout} />}
      {toastState && <div className="toast" role={toastState.kind === "error" ? "alert" : "status"} data-kind={toastState.kind}>{toastState.text}</div>}
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="stack" aria-busy="true" aria-label="Carregando">
      <div className="skeleton" style={{ width: "40%", height: 36 }} />
      <div className="skeleton" style={{ width: "65%" }} />
      <div className="grid-3" style={{ marginTop: 24 }}>
        <div className="skeleton" style={{ height: 140 }} /><div className="skeleton" style={{ height: 140 }} /><div className="skeleton" style={{ height: 140 }} />
      </div>
    </div>
  );
}

function Palette({ isAdmin, onClose, onLogout }: { isAdmin: boolean; onClose: () => void; onLogout: () => void }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const items = useMemo(() => {
    const all: (NavItem & { hint: string; run?: () => void })[] = [
      { href: "/painel", label: "Início", hint: "Painel" },
      ...groups.flatMap((group) => group.items.map((item) => ({ ...item, hint: group.label }))),
      { href: "/notificacoes", label: "Notificações", hint: "Conta" },
      { href: "/perfil", label: "Perfil", hint: "Conta" },
      { href: "/meus-dados", label: "Privacidade e dados", hint: "Conta", keywords: "exportar excluir lgpd" },
      ...(isAdmin ? [{ href: "/admin", label: "Quartel general", hint: "Administração" }, { href: "/admin/catalogo", label: "Pré-cadastros", hint: "Administração" }] : []),
      { href: "#", label: "Sair da conta", hint: "Conta", run: onLogout },
    ];
    const q = query.trim().toLowerCase();
    return all.filter((item, index, list) => list.findIndex((other) => other.href === item.href && other.label === item.label) === index)
      .filter((item) => !q || `${item.label} ${item.hint} ${item.keywords ?? ""}`.toLowerCase().includes(q));
  }, [query, isAdmin, onLogout]);

  const go = (index: number) => {
    const item = items[index];
    if (!item) return;
    onClose();
    if (item.run) item.run(); else router.push(item.href);
  };

  return (
    <div className="palette-backdrop" onClick={onClose}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Ir para" onClick={(event) => event.stopPropagation()}>
        <input autoFocus value={query} placeholder="Para onde você quer ir?" aria-label="Buscar"
          onChange={(event) => { setQuery(event.target.value); setActive(0); }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(items.length - 1, i + 1)); }
            if (event.key === "ArrowUp") { event.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
            if (event.key === "Enter") go(active);
          }} />
        <ul role="listbox">
          {items.map((item, index) => (
            <li key={item.href + item.label}>
              <button type="button" data-active={index === active} onMouseEnter={() => setActive(index)} onClick={() => go(index)} data-p={item.p}>
                <span className="dot" />{item.label}<small>{item.hint}</small>
              </button>
            </li>
          ))}
          {!items.length && <li className="faint" style={{ padding: 12 }}>Nada com esse nome.</li>}
        </ul>
      </div>
    </div>
  );
}

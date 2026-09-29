"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import s from "./desafio.module.css";

const ICONES = {
  ok: <path d="m5 12 5 5 9-10" />,
  escudo: <><path d="M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
  enviar: <path d="M21 3 10 14M21 3l-7 18-4-7-7-4z" />,
  copiar: <><rect x="8" y="8" width="12" height="12" rx="3" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>,
  conversa: <path d="M20 12a8 8 0 0 1-11.6 7.1L4 20l1-4.2A8 8 0 1 1 20 12z" />,
  mais: <><circle cx="6" cy="12" r="1.3" /><circle cx="12" cy="12" r="1.3" /><circle cx="18" cy="12" r="1.3" /></>,
  olho: <><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></>,
  relogio: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  alvo: <><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1.5" fill="currentColor" /></>,
  seta: <path d="M5 12h14M13 6l6 6-6 6" />,
  voltar: <path d="M15 5l-7 7 7 7" />,
  fechar: <path d="M6 6l12 12M18 6 6 18" />,
  email: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
  casa: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  pessoas: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-4 3.3-6 6.5-6s5.7 2 6.5 6" /><circle cx="17" cy="9" r="2.8" /><path d="M16 14c3 .2 4.8 2.2 5.5 5.5" /></>,
  coracao: <path d="M12 20s-7.5-4.4-9-9.2C2 7.4 4.2 4.5 7.4 4.5c2 0 3.5 1.1 4.6 2.7 1.1-1.6 2.6-2.7 4.6-2.7 3.2 0 5.4 2.9 4.4 6.3-1.5 4.8-9 9.2-9 9.2z" />,
};
export type NomeIcone = keyof typeof ICONES;
export function Icone({ nome }: { nome: NomeIcone }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{ICONES[nome]}</svg>;
}

export function Orbe() {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="#4C8DFF" strokeWidth="1.8" transform="rotate(-24 16 16)" />
      <circle cx="27.5" cy="10.8" r="2.4" fill="#4C8DFF" /><circle cx="16" cy="16" r="4.2" fill="#FFA834" />
    </svg>
  );
}

export function Moldura({ children, aoVoltar, modoB }: { children: ReactNode; aoVoltar?: (() => void) | undefined; modoB?: boolean }) {
  return (
    <div className={s.raiz}>
      <div className={`${s.app} ${modoB ? s.modoB : ""}`}>
        <header className={s.topo}>
          {aoVoltar ? <button className={s.iconeBtn} type="button" onClick={aoVoltar} aria-label="Voltar"><Icone nome="voltar" /></button> : null}
          <Link className={s.marca} href="/"><Orbe />orvok</Link>
          <Link className={s.iconeBtn} href="/" aria-label="Sair do desafio"><Icone nome="fechar" /></Link>
        </header>
        {children}
      </div>
    </div>
  );
}

export function Inicial({ nome, ambar, tamanho }: { nome: string; ambar?: boolean; tamanho: number }) {
  return (
    <span className={`${s.ini} ${ambar ? s.iniAmbar : ""}`} style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.42) }}>
      {(nome.trim()[0] ?? "?").toUpperCase()}
    </span>
  );
}

/** Anel de progresso: um ponto por pergunta respondida. */
export function Anel({ nome, feitas, atual, ambar }: { nome: string; feitas: number; atual: number; ambar?: boolean }) {
  return (
    <div className={s.anel}>
      <svg viewBox="0 0 132 132" aria-hidden="true">
        <circle cx="66" cy="66" r="58" fill="none" stroke="var(--fio)" strokeDasharray="2 5" />
        {Array.from({ length: 10 }, (_, k) => {
          const a = (k / 10) * Math.PI * 2 - Math.PI / 2, feito = k < feitas;
          const cor = feito ? (ambar ? "var(--azul-luz)" : "var(--ambar)") : "var(--fio-2)";
          return <circle key={k} cx={66 + Math.cos(a) * 58} cy={66 + Math.sin(a) * 58} r={feito ? 6 : 5}
            fill={k === atual && !feito ? "transparent" : cor} stroke={k === atual && !feito ? "var(--tinta)" : "none"} strokeWidth="1.5" />;
        })}
      </svg>
      <Inicial nome={nome} ambar={Boolean(ambar)} tamanho={64} />
    </div>
  );
}

/** Radar do resultado: acertos perto do centro, erros na borda. */
export function Radar({ acertos, visivel }: { acertos: number; visivel: boolean }) {
  return (
    <svg viewBox="0 0 280 280" className={visivel ? s.vis : ""} aria-hidden="true">
      <defs>
        <linearGradient id="varreDesafio" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#4C8DFF" stopOpacity=".4" /><stop offset="1" stopColor="#4C8DFF" stopOpacity="0" /></linearGradient>
      </defs>
      {[130, 90, 50].map((r) => <circle key={r} cx="140" cy="140" r={r} fill="none" stroke="var(--fio-2)" />)}
      <g className={s.varre}><path d="M140 140 L140 10 A130 130 0 0 1 250 70 Z" fill="url(#varreDesafio)" /></g>
      {Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2, ok = k < acertos, r = ok ? 68 + (k % 3) * 9 : 110 + (k % 2) * 8;
        return <circle key={k} className={s.pt} style={{ transitionDelay: `${0.2 + k * 0.09}s`, filter: ok ? "drop-shadow(0 0 6px #FFA834)" : undefined }}
          cx={140 + Math.cos(a) * r} cy={140 + Math.sin(a) * r} r={ok ? 8 : 6} fill={ok ? "var(--ambar)" : "var(--fio-2)"} />;
      })}
    </svg>
  );
}

export async function enviarJson<T>(caminho: string, corpo: unknown): Promise<{ ok: boolean; status: number; dados: T & { code?: string } }> {
  const r = await fetch(caminho, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(corpo), credentials: "same-origin" });
  const dados = (await r.json().catch(() => ({}))) as T & { code?: string };
  return { ok: r.ok, status: r.status, dados };
}

/** Login com Google que volta para os resultados, onde o desafio é vinculado à conta. */
export const LOGIN_GOOGLE = `/api/v1/auth/google/start?returnTo=${encodeURIComponent("/desafios")}`;

/**
 * Conta de quem está usando o desafio. undefined enquanto carrega, null sem
 * login, ou o primeiro nome do perfil de quem já entrou.
 */
export function useConta(): { nome: string } | null | undefined {
  const [conta, setConta] = useState<{ nome: string } | null | undefined>(undefined);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const sessao = await fetch("/api/v1/auth/session?optional=1", { credentials: "same-origin", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : { authenticated: false })).catch(() => ({ authenticated: false })) as { authenticated?: boolean };
      if (!sessao.authenticated) { if (ativo) setConta(null); return; }
      const perfil = await fetch("/api/v1/social/profile", { credentials: "same-origin", cache: "no-store" })
        .then((r) => (r.ok ? r.json() : {})).catch(() => ({})) as { profile?: { displayName?: string } | null };
      const nome = (perfil.profile?.displayName ?? "").trim().split(/\s+/)[0] ?? "";
      if (ativo) setConta(nome.length >= 2 ? { nome } : null);
    })();
    return () => { ativo = false; };
  }, []);
  return conta;
}

export { s as estilos };

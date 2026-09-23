"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrvokLogo } from "./brand/OrvokLogo";

type Session = { authenticated?: boolean; role?: string };

export function SiteHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<Session> : null)
      .then((session) => {
        if (!active) return;
        setIsAuthenticated(session?.authenticated === true);
        setIsAdmin(session?.role === "ADMIN");
      })
      .catch(() => { if (active) { setIsAuthenticated(false); setIsAdmin(false); } });
    return () => { active = false; };
  }, []);

  async function logout() {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      const response = await fetch("/api/v1/auth/logout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      if (!response.ok) throw new Error("logout_failed");
      setIsAuthenticated(false);
      setIsAdmin(false);
      window.location.assign("/entrar?logged_out=1");
    } finally {
      setLoggingOut(false);
    }
  }

  const accountLinks = <>
    {isAuthenticated && <Link href="/perfil">Meu painel</Link>}
    {isAdmin && <Link href="/admin">Admin</Link>}
    {isAuthenticated && <button type="button" className="text-link" onClick={() => void logout()} disabled={loggingOut}>{loggingOut ? "Saindo…" : "Sair"}</button>}
    {!isAuthenticated && <><Link href="/entrar">Entrar</Link><Link href="/cadastro">Criar conta</Link></>}
  </>;

  return <header className="site-header">
    <div className="container header-inner">
      <Link href="/" aria-label="ORVOK — início"><OrvokLogo /></Link>
      <nav className="site-nav" aria-label="Navegação principal">
        <Link href="/#mundo">Mundo</Link><Link href="/#pessoas">Pessoas</Link><Link href="/#voce">Você</Link><Link href="/#comunidade">Comunidade</Link><Link href="/#sobre">Sobre</Link>
      </nav>
      <div className="header-actions">
        <details className="mobile-menu"><summary>Menu</summary><nav aria-label="Navegação móvel"><Link href="/#mundo">Mundo</Link><Link href="/#pessoas">Pessoas</Link><Link href="/#voce">Você</Link><Link href="/#comunidade">Comunidade</Link><Link href="/#sobre">Sobre</Link><Link href="/convites">Convites</Link><Link href="/radar">Radar</Link>{accountLinks}</nav></details>
        <Link href="/radar" className="text-link">Radar</Link>{accountLinks}
      </div>
    </div>
  </header>;
}

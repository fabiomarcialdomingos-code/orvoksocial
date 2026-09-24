"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrvokLogo } from "./brand/OrvokLogo";

type Session = { authenticated?: boolean; role?: string };

export function SiteHeader() {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/session", {
      credentials: "same-origin",
      cache: "no-store",
    })
      .then((response) => (response.ok ? (response.json() as Promise<Session>) : null))
      .then((session) => {
        if (!active) return;
        setIsAuthenticated(session?.authenticated === true);
        setIsAdmin(session?.role === "ADMIN");
      })
      .catch(() => {
        if (active) {
          setIsAuthenticated(false);
          setIsAdmin(false);
        }
      });

    return () => {
      active = false;
    };
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
      router.push("/entrar?logged_out=1");
    } finally {
      setLoggingOut(false);
    }
  }

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" className="header-brand" aria-label="ORVOK — início">
          <OrvokLogo />
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <Link href="/#sobre">O que é o ORVOK</Link>
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/#pessoas">Pessoas</Link>
          <Link href="/#mundo">Mundo</Link>
          <Link href="/#manifesto">Manifesto</Link>
        </nav>
        <div className="header-actions">
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Navegação móvel">
              <Link href="/#sobre">O que é o ORVOK</Link>
              <Link href="/#como-funciona">Como funciona</Link>
              <Link href="/#pessoas">Pessoas</Link>
              <Link href="/#mundo">Mundo</Link>
              <Link href="/#manifesto">Manifesto</Link>
              <Link href="/eventos">Prever o mundo</Link>
              <Link href="/radar">Radar Humano</Link>
              {isAuthenticated && <Link href="/perfil">Meu painel</Link>}
              {isAdmin && <Link href="/admin">Admin</Link>}
              {isAuthenticated ? (
                <button type="button" className="text-link" onClick={() => void logout()} disabled={loggingOut}>
                  {loggingOut ? "Saindo…" : "Sair"}
                </button>
              ) : (
                <>
                  <Link href="/entrar">Entrar</Link>
                  <Link href="/cadastro">Começar agora</Link>
                </>
              )}
            </nav>
          </details>
          {isAuthenticated ? (
            <>
              <Link href="/radar" className="header-quiet-link">Radar Humano</Link>
              <Link href="/perfil" className="header-quiet-link">Meu painel</Link>
              {isAdmin && <Link href="/admin" className="header-quiet-link">Admin</Link>}
              <button type="button" className="header-quiet-link header-logout" onClick={() => void logout()} disabled={loggingOut}>
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            </>
          ) : (
            <>
              <Link href="/entrar" className="header-quiet-link">Entrar</Link>
              <Link href="/cadastro" className="button header-cta">Começar agora <span aria-hidden="true">→</span></Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { OrvokLogo } from "./brand/OrvokLogo";
export function SiteHeader() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  useEffect(() => {
    let active = true;
    void fetch("/api/v1/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((response) => response.ok ? response.json() as Promise<{ authenticated?: boolean; role?: string }> : null)
      .then((session) => {
        if (!active) return;
        setIsAuthenticated(session?.authenticated === true);
        setIsAdmin(session?.role === "ADMIN");
      })
      .catch(() => { if (active) { setIsAuthenticated(false); setIsAdmin(false); } });
    return () => { active = false; };
  }, []);
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link href="/" aria-label="ORVOK — início">
          <OrvokLogo />
        </Link>
        <nav className="site-nav" aria-label="Navegação principal">
          <Link href="/#mundo">Mundo</Link>
          <Link href="/#pessoas">Pessoas</Link>
          <Link href="/#voce">Você</Link>
          <Link href="/#comunidade">Comunidade</Link>
          <Link href="/#sobre">Sobre</Link>
        </nav>
        <div className="header-actions">
          <details className="mobile-menu">
            <summary>Menu</summary>
            <nav aria-label="Navegação móvel">
              <Link href="/#mundo">Mundo</Link>
              <Link href="/#pessoas">Pessoas</Link>
              <Link href="/#voce">Você</Link>
              <Link href="/#comunidade">Comunidade</Link>
              <Link href="/#sobre">Sobre</Link>
              <Link href="/convites">Convites</Link>
              <Link href="/radar">Radar</Link>
              {isAuthenticated && <Link href="/perfil">Meu painel</Link>}
              {isAdmin && <Link href="/admin">Admin</Link>}
              <Link href="/entrar">Entrar</Link>
              <Link href="/cadastro">Criar conta</Link>
            </nav>
          </details>
          <Link href="/radar" className="text-link">Radar</Link>
          {isAuthenticated && <Link href="/perfil" className="text-link">Meu painel</Link>}
          {isAdmin && <Link href="/admin" className="text-link">Admin</Link>}
          <Link href="/entrar" className="text-link">
            Entrar
          </Link>
          <Link href="/cadastro" className="button">
            Criar conta <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

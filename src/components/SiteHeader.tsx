"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { OrvokLogo } from "./brand/OrvokLogo";

type Session = { authenticated?: boolean; role?: string };

type SiteHeaderProps = { variant?: "public" | "app" };

export function SiteHeader({ variant = "public" }: SiteHeaderProps) {
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
      .then((response) =>
        response.ok ? (response.json() as Promise<Session>) : null,
      )
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

  if (variant === "app") {
    return (
      <header className="site-header app-site-header">
        <div className="container app-header-inner">
          <Link href="/" className="header-brand" aria-label="ORVOK — início">
            <OrvokLogo />
          </Link>
          <nav className="app-site-nav" aria-label="Navegação do aplicativo">
            <Link href="/">Início</Link>
            <Link href="/radar" aria-current="page">
              Radar Humano
            </Link>
            <Link href="/perfil">Pessoas</Link>
            <Link href="/eventos">Mundo</Link>
            <Link href="/perfil">Perfil</Link>
          </nav>
          <div className="app-header-actions">
            <button
              className="app-icon-button"
              type="button"
              aria-label="Notificações"
            >
              <span className="bell-icon" aria-hidden="true" />
              <span className="notification-badge" aria-hidden="true" />
            </button>
            <span className="header-divider" aria-hidden="true" />
            <Link
              className="app-avatar"
              href="/perfil"
              aria-label="Abrir perfil"
            >
              VC
            </Link>
            <Link className="app-user-name" href="/perfil">
              Você <span aria-hidden="true">⌄</span>
            </Link>
            <Link href="/convites" className="button app-header-cta">
              Convidar pessoa <span aria-hidden="true">→</span>
            </Link>
          </div>
          <details className="mobile-menu app-mobile-menu">
            <summary aria-label="Abrir menu">Menu</summary>
            <nav aria-label="Navegação móvel do aplicativo">
              <Link href="/">Início</Link>
              <Link href="/radar">Radar Humano</Link>
              <Link href="/perfil">Pessoas</Link>
              <Link href="/eventos">Mundo</Link>
              <Link href="/perfil">Perfil</Link>
              <Link href="/convites">Convidar pessoa</Link>
            </nav>
          </details>
        </div>
      </header>
    );
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
                <button
                  type="button"
                  className="text-link"
                  onClick={() => void logout()}
                  disabled={loggingOut}
                >
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
              <Link href="/radar" className="header-quiet-link">
                Radar Humano
              </Link>
              <Link href="/perfil" className="header-quiet-link">
                Meu painel
              </Link>
              {isAdmin && (
                <Link href="/admin" className="header-quiet-link">
                  Admin
                </Link>
              )}
              <button
                type="button"
                className="header-quiet-link header-logout"
                onClick={() => void logout()}
                disabled={loggingOut}
              >
                {loggingOut ? "Saindo…" : "Sair"}
              </button>
            </>
          ) : (
            <>
              <Link href="/entrar" className="header-quiet-link">
                Entrar
              </Link>
              <Link href="/cadastro" className="button header-cta">
                Começar agora <span aria-hidden="true">→</span>
              </Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

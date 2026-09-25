"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Brand } from "../ui/Brand";

export function SiteNav() {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    fetch("/api/v1/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { authenticated?: boolean } | null) => setSignedIn(Boolean(data?.authenticated)))
      .catch(() => undefined);
  }, []);
  return (
    <header className="site-nav">
      <div className="container site-nav-inner">
        <Brand />
        <nav aria-label="Navegação principal">
          <Link href="/#como-funciona">Como funciona</Link>
          <Link href="/#perspectivas">Perspectivas</Link>
          <Link href="/#consentimento">Consentimento</Link>
        </nav>
        <div className="site-nav-actions">
          {signedIn ? (
            <Link href="/painel" className="button button-small">Abrir meu painel</Link>
          ) : (
            <>
              <Link href="/entrar" className="text-link">Entrar</Link>
              <Link href="/cadastro" className="button button-small">Criar conta</Link>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

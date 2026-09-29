"use client";
import { useEffect, useState } from "react";
import { AppShell } from "../app/AppShell";
import { MeusDesafios } from "../desafio/MeusDesafios";
import { DesafiosConta } from "./DesafiosConta";

/** Com conta: tela de desafios na rede. Sem conta: resultado do aparelho, no fluxo do desafio. */
export function DesafiosPagina() {
  const [logado, setLogado] = useState<boolean | null>(null);
  useEffect(() => {
    fetch("/api/v1/auth/session?optional=1", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { authenticated: false })).then((d: { authenticated?: boolean }) => setLogado(Boolean(d.authenticated)))
      .catch(() => setLogado(false));
  }, []);
  if (logado === null) return null;
  return logado ? <AppShell title="Desafios"><DesafiosConta /></AppShell> : <MeusDesafios />;
}

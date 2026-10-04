"use client";
import { useEffect } from "react";

/** Registra o service worker para o orvok poder ser instalado na tela do celular.
 * O navegador só checa sw.js por conta própria de tempos em tempos (~24h); forçar
 * update() a cada carregamento evita visitantes presos numa versão antiga do
 * cache por horas depois de um deploy. */
export function RegistrarApp() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").then((reg) => void reg.update().catch(() => undefined)).catch(() => undefined);
  }, []);
  return null;
}

"use client";
import { useEffect } from "react";

/** Registra o service worker para o orvok poder ser instalado na tela do celular. */
export function RegistrarApp() {
  useEffect(() => {
    if ("serviceWorker" in navigator) void navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);
  return null;
}

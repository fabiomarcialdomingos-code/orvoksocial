"use client";
import { useEffect, useState } from "react";
import { apiPost } from "../../lib/client/api";
import { useShell } from "./AppShell";

function paraUint8(base64url: string): Uint8Array {
  const base64 = (base64url + "=".repeat((4 - (base64url.length % 4)) % 4)).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

type Estado = "indisponivel" | "verificando" | "desligado" | "bloqueado" | "ligado";

/**
 * Avisos push, sempre por escolha explícita da pessoa (nunca pedido sozinho
 * ao abrir uma tela). Sem isso, o orvok funciona normal, só sem avisar
 * quando está fechado.
 */
export function AtivarAvisos() {
  const { toast } = useShell();
  const [estado, setEstado] = useState<Estado>("verificando");
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    void (async () => {
      if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) { setEstado("indisponivel"); return; }
      const r = await fetch("/api/v1/push/public-key", { credentials: "same-origin" }).then((x) => x.json()).catch(() => null);
      if (!ativo) return;
      if (!r?.disponivel) { setEstado("indisponivel"); return; }
      if (Notification.permission === "denied") { setEstado("bloqueado"); return; }
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (ativo) setEstado(sub ? "ligado" : "desligado");
    })();
    return () => { ativo = false; };
  }, []);

  const ativar = async () => {
    setOcupado(true);
    try {
      const permissao = await Notification.requestPermission();
      if (permissao !== "granted") { setEstado(permissao === "denied" ? "bloqueado" : "desligado"); return; }
      const r = await fetch("/api/v1/push/public-key", { credentials: "same-origin" }).then((x) => x.json());
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: paraUint8(r.chave) as BufferSource });
      await apiPost("/push/subscribe", sub.toJSON());
      setEstado("ligado");
      toast("Avisos ativados. Você pode desligar quando quiser.");
    } catch {
      toast("Não foi possível ativar agora. Tente de novo.", "error");
    } finally {
      setOcupado(false);
    }
  };

  const desligar = async () => {
    setOcupado(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) { await apiPost("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => undefined); await sub.unsubscribe(); }
      setEstado("desligado");
    } finally {
      setOcupado(false);
    }
  };

  if (estado === "indisponivel" || estado === "verificando") return null;
  if (estado === "bloqueado") return (
    <p className="muted" style={{ fontSize: 13, margin: "0 0 14px" }}>Os avisos deste aparelho estão bloqueados nas configurações do navegador.</p>
  );
  return estado === "ligado" ? (
    <button type="button" className="text-link" style={{ fontSize: 13, marginBottom: 14, background: "none", border: 0, cursor: "pointer" }} disabled={ocupado} onClick={() => void desligar()}>Avisos ativados neste aparelho · Desligar</button>
  ) : (
    <button type="button" className="text-link" style={{ fontSize: 13, marginBottom: 14, background: "none", border: 0, cursor: "pointer" }} disabled={ocupado} onClick={() => void ativar()}>Ativar avisos neste aparelho</button>
  );
}

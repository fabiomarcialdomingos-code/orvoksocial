"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const PENDING_KEY = "orvok:convite";

/** Signed in: redeem now. Signed out: remember the code, then sign up or in. */
export function AcceptChallenge({ code, name }: { code: string; name: string }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");

  useEffect(() => {
    fetch("/api/v1/auth/session", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((d: { authenticated?: boolean }) => setSignedIn(Boolean(d.authenticated)))
      .catch(() => setSignedIn(false));
  }, []);

  const remember = () => { try { sessionStorage.setItem(PENDING_KEY, code); localStorage.setItem(PENDING_KEY, code); } catch { /* storage off */ } };

  const redeem = async () => {
    setState("pending");
    const r = await fetch("/api/v1/radar/share-links/redeem", {
      method: "POST", credentials: "same-origin",
      headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
      body: JSON.stringify({ code }),
    });
    if (r.ok) { try { sessionStorage.removeItem(PENDING_KEY); localStorage.removeItem(PENDING_KEY); } catch { /* ignore */ } router.push(`/convites?desafio=aceito`); return; }
    setState("error");
    setMessage(r.status === 422 ? "Este convite não pode ser usado por esta conta (talvez seja o seu próprio link)." : "Não foi possível aceitar agora. Tente de novo.");
  };

  if (signedIn === null) return <div className="hero-actions"><span className="skeleton" style={{ width: 220, height: 44 }} /></div>;
  return (
    <>
      <div className="hero-actions">
        {signedIn ? (
          <button className="button" data-p="people" disabled={state === "pending"} onClick={() => void redeem()}>
            {state === "pending" ? "Enviando pedido…" : `Aceitar o desafio de ${name}`}
          </button>
        ) : (
          <>
            <Link className="button" data-p="people" href={`/cadastro?returnTo=/c/${code}`} onClick={remember}>Criar conta e aceitar</Link>
            <Link className="button button-secondary" href={`/entrar?returnTo=/c/${code}`} onClick={remember}>Já tenho conta</Link>
          </>
        )}
      </div>
      {state === "error" && <p className="form-message" data-kind="error" role="alert">{message}</p>}
      <p className="faint" style={{ marginTop: 20, fontSize: 14 }}>Ao aceitar, um pedido é enviado para {name}. Você poderá prever assim que {name} consentir e você responder o seu próprio gabarito.</p>
    </>
  );
}

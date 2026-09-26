"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const PENDING_KEY = "orvok:convite";
const GUESS_KEY_PREFIX = "orvok:convite-palpite:";

type TeaserOption = { id: string; label: string; position: number };
type Guess = { code: string; questionVersionId: string; optionId: string };

function readGuess(code: string): Guess | null {
  try {
    const raw = localStorage.getItem(GUESS_KEY_PREFIX + code) ?? sessionStorage.getItem(GUESS_KEY_PREFIX + code);
    return raw ? (JSON.parse(raw) as Guess) : null;
  } catch { return null; }
}

/** Signed out: guess first (no account needed), then sign up to see if you were right.
 *  Signed in: redeem immediately. */
export function AcceptChallenge({
  code, name, teaserQuestionVersionId, teaserOptions,
}: { code: string; name: string; teaserQuestionVersionId: string | null; teaserOptions: TeaserOption[] }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [guess, setGuess] = useState<Guess | null>(null);

  useEffect(() => {
    setGuess(readGuess(code));
    fetch("/api/v1/auth/session?optional=1", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((d: { authenticated?: boolean }) => setSignedIn(Boolean(d.authenticated)))
      .catch(() => setSignedIn(false));
  }, [code]);

  const remember = () => {
    try { sessionStorage.setItem(PENDING_KEY, code); localStorage.setItem(PENDING_KEY, code); } catch { /* storage off */ }
  };

  const pickOption = (optionId: string) => {
    if (!teaserQuestionVersionId) return;
    const next = { code, questionVersionId: teaserQuestionVersionId, optionId };
    try { localStorage.setItem(GUESS_KEY_PREFIX + code, JSON.stringify(next)); } catch { /* storage off */ }
    setGuess(next);
  };

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

  if (signedIn) {
    return (
      <>
        <div className="hero-actions">
          <button className="button" data-p="people" disabled={state === "pending"} onClick={() => void redeem()}>
            {state === "pending" ? "Enviando pedido…" : `Aceitar o desafio de ${name}`}
          </button>
        </div>
        {state === "error" && <p className="form-message" data-kind="error" role="alert">{message}</p>}
        <p className="faint" style={{ marginTop: 20, fontSize: 14 }}>Ao aceitar, um pedido é enviado para {name}. Você poderá prever assim que {name} consentir e você responder o seu próprio gabarito.</p>
      </>
    );
  }

  // Signed out and no guess yet: let them guess before asking for an account.
  if (!guess && teaserQuestionVersionId && teaserOptions.length > 0) {
    return (
      <div className="options" role="radiogroup" aria-label="Sua previsão">
        {teaserOptions.map((option) => (
          <button key={option.id} type="button" role="radio" className="option lit" data-p="people"
            onClick={() => pickOption(option.id)}>
            <span>{option.label}</span>
          </button>
        ))}
        <p className="faint" style={{ marginTop: 16, fontSize: 14 }}>Escolha o que você acha que {name} respondeu. Depois disso você cria uma conta pra ver se acertou.</p>
      </div>
    );
  }

  // Guessed (or no teaser available): ask for an account to save the guess and continue.
  return (
    <>
      <div className="hero-actions">
        <Link className="button" data-p="people" href={`/cadastro?returnTo=/c/${code}`} onClick={remember}>Criar conta e ver se acertei</Link>
        <Link className="button button-secondary" href={`/entrar?returnTo=/c/${code}`} onClick={remember}>Já tenho conta</Link>
      </div>
      <p className="faint" style={{ marginTop: 20, fontSize: 14 }}>Seu palpite fica guardado neste navegador. Ao criar a conta, um pedido é enviado para {name}; você vê o resultado assim que {name} consentir e você responder o seu próprio gabarito.</p>
    </>
  );
}

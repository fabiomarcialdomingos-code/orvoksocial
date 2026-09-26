"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export const PENDING_KEY = "orvok:convite";
const GUESS_KEY_PREFIX = "orvok:convite-palpite:";
const KEYS = ["A", "B", "C", "D", "E", "F"];

type TeaserOption = { id: string; label: string; position: number };
type CatalogQuestion = { questionVersionId: string; text: string; options: TeaserOption[] };
type GuessMap = Record<string, string>; // questionVersionId -> optionId

function readGuesses(code: string): GuessMap {
  try {
    const raw = localStorage.getItem(GUESS_KEY_PREFIX + code) ?? sessionStorage.getItem(GUESS_KEY_PREFIX + code);
    return raw ? (JSON.parse(raw) as GuessMap) : {};
  } catch { return {}; }
}

/** Signed out: guess every question about the inviter first, no account needed.
 *  Only after the last question do we offer to create an account.
 *  Signed in: redeem immediately (they already went through this once). */
export function AcceptChallenge({
  code, name, catalog,
}: { code: string; name: string; catalog: CatalogQuestion[] }) {
  const router = useRouter();
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [state, setState] = useState<"idle" | "pending" | "error">("idle");
  const [message, setMessage] = useState("");
  const [guesses, setGuesses] = useState<GuessMap>({});

  useEffect(() => {
    setGuesses(readGuesses(code));
    fetch("/api/v1/auth/session?optional=1", { credentials: "same-origin", cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { authenticated: false }))
      .then((d: { authenticated?: boolean }) => setSignedIn(Boolean(d.authenticated)))
      .catch(() => setSignedIn(false));
  }, [code]);

  const remember = () => {
    try { sessionStorage.setItem(PENDING_KEY, code); localStorage.setItem(PENDING_KEY, code); } catch { /* storage off */ }
  };

  const pickOption = (questionVersionId: string, optionId: string) => {
    const next = { ...guesses, [questionVersionId]: optionId };
    try { localStorage.setItem(GUESS_KEY_PREFIX + code, JSON.stringify(next)); } catch { /* storage off */ }
    setGuesses(next);
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
        <p className="faint" style={{ marginTop: 20, fontSize: 14 }}>Ao aceitar, um pedido é enviado para {name}. Você poderá prever assim que {name} consentir e você responder a sua própria referência.</p>
      </>
    );
  }

  const pendingIndex = catalog.findIndex((q) => !guesses[q.questionVersionId]);
  const allAnswered = catalog.length > 0 && pendingIndex === -1;

  // Signed out, still has questions left to guess: show one at a time.
  if (catalog.length > 0 && !allAnswered) {
    const question = catalog[pendingIndex]!;
    return (
      <div className="card form-stack">
        <div className="quiz-progress" aria-label={`Pergunta ${pendingIndex + 1} de ${catalog.length}`}>
          {catalog.map((q, i) => <i key={q.questionVersionId} data-on={Boolean(guesses[q.questionVersionId]) || i === pendingIndex} />)}
        </div>
        <span className="eyebrow">Pergunta {pendingIndex + 1} de {catalog.length} — seu palpite sobre {name}</span>
        <h3 style={{ marginTop: 8 }}>{question.text}</h3>
        <div className="options" role="radiogroup" aria-label="Sua previsão">
          {question.options.map((option, i) => (
            <button key={option.id} type="button" role="radio" className="option lit" data-p="people"
              onClick={() => pickOption(question.questionVersionId, option.id)}>
              <span className="key">{KEYS[i]}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <p className="faint" style={{ fontSize: 14 }}>Responda todas as perguntas sobre {name}. No final, criamos sua conta pra você ver se acertou.</p>
      </div>
    );
  }

  // All guessed (or no catalog available): ask for an account to save the guesses and continue.
  return (
    <>
      <div className="hero-actions">
        <Link className="button" data-p="people" href={`/cadastro?returnTo=/c/${code}`} onClick={remember}>Criar conta e ver se acertei</Link>
        <Link className="button button-secondary" href={`/entrar?returnTo=/c/${code}`} onClick={remember}>Já tenho conta</Link>
      </div>
      <p className="faint" style={{ marginTop: 20, fontSize: 14 }}>Seus palpites ficam guardados neste navegador. Ao criar a conta, um pedido é enviado para {name}; você vê o resultado assim que {name} consentir.</p>
    </>
  );
}

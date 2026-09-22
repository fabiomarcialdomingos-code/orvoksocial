"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";

type Notice = {
  schemaVersion: string;
  version: string;
  content: string;
  contentHash: string;
  presentationId: string;
};
type Mode = "invite" | "accept" | "consent";
type Feedback = { kind: "success" | "error"; text: string };
type Invitation = {
  id: string;
  predictorId: string;
  targetId: string;
  invitedAt: string;
  acceptedAt: string | null;
  acceptanceId: string | null;
};
type Consent = {
  id: string;
  purpose: string;
  scope: string;
  noticeVersion: string;
  consentVersion: number;
  grantedAt: string;
  revokedAt: string | null;
};

async function post(path: string, body: object) {
  return fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  });
}

export function RadarFlow({
  mode,
  initialAcceptanceId = "",
}: {
  mode: Mode;
  initialAcceptanceId?: string;
}) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [noticeUnavailable, setNoticeUnavailable] = useState(false);
  const [selectedAcceptanceId, setSelectedAcceptanceId] =
    useState(initialAcceptanceId);
  const acceptanceRef = useRef(initialAcceptanceId);
  const [grantId, setGrantId] = useState<string | null>(null);
  const [acceptanceId, setAcceptanceId] = useState<string | null>(null);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [consents, setConsents] = useState<Consent[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    const path =
      mode === "consent"
        ? "/api/v1/radar/consents"
        : "/api/v1/radar/invitations";
    fetch(path, { credentials: "same-origin", signal: controller.signal })
      .then(async (response) =>
        response.ok
          ? (response.json() as Promise<{ items: Invitation[] | Consent[] }>)
          : null,
      )
      .then((data) => {
        if (!data) return;
        if (mode === "consent") setConsents(data.items as Consent[]);
        else setInvitations(data.items as Invitation[]);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [mode]);
  useEffect(() => {
    if (mode !== "consent") return;
    if (
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(
        selectedAcceptanceId,
      )
    )
      return;
    const controller = new AbortController();
    fetch(
      `/api/v1/consent-notice?purpose=BE_PREDICTED&acceptanceId=${encodeURIComponent(selectedAcceptanceId)}`,
      {
        credentials: "same-origin",
        signal: controller.signal,
      },
    )
      .then(async (response) => {
        if (!response.ok) throw new Error("unavailable");
        return response.json() as Promise<Notice>;
      })
      .then((data) => {
        if (controller.signal.aborted || acceptanceRef.current !== selectedAcceptanceId) return;
        if (
          data.version &&
          data.content &&
          data.presentationId &&
          /^[a-f0-9]{64}$/i.test(data.contentHash)
        )
          setNotice(data);
        else setNoticeUnavailable(true);
      })
      .catch(() => {
        if (!controller.signal.aborted) setNoticeUnavailable(true);
      });
    return () => controller.abort();
  }, [mode, selectedAcceptanceId]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setFeedback(null);
    const fields = new FormData(event.currentTarget);
    try {
      let response: Response;
      if (mode === "invite")
        response = await post("/api/v1/radar/invitations", {
          targetId: String(fields.get("targetId") ?? ""),
        });
      else if (mode === "accept")
        response = await post(
          `/api/v1/radar/invitations/${encodeURIComponent(String(fields.get("invitationId") ?? ""))}/accept`,
          {},
        );
      else {
        if (!notice || fields.get("confirmed") !== "on") {
          setFeedback({
            kind: "error",
            text: "Leia e confirme o aviso antes de decidir.",
          });
          return;
        }
        response = await post("/api/v1/radar/consents", {
          acceptanceId: selectedAcceptanceId,
          presentationId: notice.presentationId,
          accepted: true,
          noticeVersion: notice.version,
          noticeHash: notice.contentHash,
          scope: String(fields.get("scope") ?? "PRIVATE"),
        });
      }
      if (!response.ok) {
        setFeedback({
          kind: "error",
          text:
            response.status === 429
              ? "Muitas tentativas. Aguarde e tente novamente."
              : "Não foi possível concluir. Verifique sua sessão e os dados informados.",
        });
        return;
      }
      const data = (await response.json()) as {
        invitationId?: string;
        acceptanceId?: string;
        grantId?: string;
      };
      if (mode === "invite" && data.invitationId)
        setFeedback({
          kind: "success",
          text: `Convite registrado. Identificador: ${data.invitationId}`,
        });
      else if (mode === "accept" && data.acceptanceId) {
        setAcceptanceId(data.acceptanceId);
        setFeedback({
          kind: "success",
          text: "Convite aceito. O consentimento é uma decisão separada.",
        });
      } else if (mode === "consent" && data.grantId) {
        setGrantId(data.grantId);
        setFeedback({
          kind: "success",
          text: "Consentimento registrado. Você pode revogá-lo a qualquer momento.",
        });
      } else
        setFeedback({
          kind: "error",
          text: "Resposta inesperada do serviço. Atualize a página antes de tentar novamente.",
        });
    } catch {
      setFeedback({
        kind: "error",
        text: "Sem conexão. Verifique sua internet e tente novamente.",
      });
    } finally {
      setPending(false);
    }
  }

  async function revoke() {
    if (!grantId) return;
    setPending(true);
    setFeedback(null);
    try {
      const response = await post(
        `/api/v1/radar/consents/${encodeURIComponent(grantId)}/revoke`,
        {},
      );
      setFeedback(
        response.ok
          ? {
              kind: "success",
              text: "Consentimento revogado. Novas previsões ficam bloqueadas.",
            }
          : {
              kind: "error",
              text: "Não foi possível revogar agora. Tente novamente.",
            },
      );
      if (response.ok) setGrantId(null);
    } catch {
      setFeedback({
        kind: "error",
        text: "Sem conexão. Tente novamente para confirmar a revogação.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <h2 className="display">
        {mode === "invite"
          ? "Convidar pessoa"
          : mode === "accept"
            ? "Aceitar convite"
            : "Sua decisão de consentimento"}
      </h2>
      <ol className="workflow" aria-label="Etapas do Radar">
        <li aria-current={mode === "invite" ? "step" : undefined}>Convite</li>
        <li aria-current={mode === "accept" ? "step" : undefined}>Aceite</li>
        <li aria-current={mode === "consent" ? "step" : undefined}>
          Consentimento
        </li>
        <li>Respostas próprias</li>
        <li>Previsão</li>
      </ol>
      {mode === "consent" && (
        <>
          {noticeUnavailable && (
            <p className="form-message" role="status">
              O aviso de consentimento aprovado ainda não está disponível. A
              decisão está bloqueada até sua publicação.
            </p>
          )}
          {!selectedAcceptanceId && (
            <p role="status">
              Selecione um convite aceito antes de visualizar o aviso.
            </p>
          )}
          {selectedAcceptanceId && !notice && !noticeUnavailable && (
            <p role="status">Carregando aviso de consentimento…</p>
          )}
          {notice && (
            <section aria-labelledby="notice-title">
              <h3 id="notice-title">
                Aviso de consentimento · versão {notice.version}
              </h3>
              <div className="notice" tabIndex={0}>
                {notice.content}
              </div>
            </section>
          )}
        </>
      )}
      {mode === "accept" && invitations.some((item) => !item.acceptedAt) && (
        <section>
          <h3>Convites disponíveis</h3>
          <ul>
            {invitations
              .filter((item) => !item.acceptedAt)
              .map((item) => (
                <li key={item.id}>
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => {
                      const input = document.getElementById(
                        "invitation-id",
                      ) as HTMLInputElement | null;
                      if (input) input.value = item.id;
                      input?.focus();
                    }}
                  >
                    Selecionar convite de {item.predictorId}
                  </button>
                </li>
              ))}
          </ul>
        </section>
      )}
      {mode === "accept" && invitations.some((item) => item.acceptanceId) && (
        <section>
          <h3>Convites aceitos</h3>
          <ul>
            {invitations
              .filter((item) => item.acceptanceId)
              .map((item) => (
                <li key={item.id}>
                  <Link
                    className="text-link"
                    href={`/consentimento?aceite=${encodeURIComponent(item.acceptanceId!)}`}
                  >
                    Decidir sobre consentimento do convite {item.id}
                  </Link>
                </li>
              ))}
          </ul>
        </section>
      )}
      {mode === "consent" && consents.length > 0 && (
        <section>
          <h3>Consentimentos registrados</h3>
          <ul>
            {consents.map((item) => (
              <li key={item.id}>
                Versão {item.consentVersion} ·{" "}
                {item.revokedAt ? "Revogado" : "Ativo"}
                {!item.revokedAt && (
                  <button
                    type="button"
                    className="text-link"
                    aria-label={`Selecionar para revogação o consentimento ${item.id}, versão ${item.consentVersion}`}
                    aria-pressed={grantId === item.id}
                    onClick={() => setGrantId(item.id)}
                  >
                    Selecionar para revogação
                  </button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
      <form onSubmit={submit} className="form-stack">
        {mode === "invite" && (
          <div className="field">
            <label htmlFor="target-id">Identificador da pessoa convidada</label>
            <input
              id="target-id"
              name="targetId"
              type="text"
              required
              autoComplete="off"
            />
            <span className="field-hint">
              A seleção por perfil ficará disponível em uma etapa posterior.
            </span>
          </div>
        )}
        {mode === "accept" && (
          <div className="field">
            <label htmlFor="invitation-id">
              Identificador do convite recebido
            </label>
            <input
              id="invitation-id"
              name="invitationId"
              type="text"
              required
              autoComplete="off"
            />
          </div>
        )}
        {mode === "consent" && (
          <>
            <div className="field">
              <label htmlFor="acceptance-id">Identificador do aceite</label>
              <input
                id="acceptance-id"
                name="acceptanceId"
                type="text"
                value={selectedAcceptanceId}
                onChange={(event) => {
                  acceptanceRef.current = event.target.value;
                  setSelectedAcceptanceId(event.target.value);
                  setNotice(null);
                  setNoticeUnavailable(false);
                }}
                required
                autoComplete="off"
              />
            </div>
            <fieldset>
              <legend>Escopo do consentimento</legend>
              <label className="checkbox-row">
                <input
                  type="radio"
                  name="scope"
                  value="PRIVATE"
                  defaultChecked
                />
                Privado
              </label>
              <label className="checkbox-row">
                <input type="radio" name="scope" value="SHARED" />
                Compartilhado
              </label>
            </fieldset>
            <label className="checkbox-row">
              <input
                name="confirmed"
                type="checkbox"
                required
                disabled={!notice}
              />
              Li o aviso acima e autorizo, de forma separada do aceite do
              convite, ser alvo de previsões no escopo escolhido.
            </label>
          </>
        )}
        {feedback && (
          <p
            className="form-message"
            data-kind={feedback.kind}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.text}
          </p>
        )}
        <div className="form-actions">
          <button
            className="button"
            type="submit"
            disabled={pending || (mode === "consent" && !notice)}
          >
            {pending
              ? "Aguarde…"
              : mode === "invite"
                ? "Enviar convite"
                : mode === "accept"
                  ? "Aceitar convite"
                  : "Registrar consentimento"}
          </button>
          {mode === "accept" && acceptanceId && (
            <Link
              className="text-link"
              href={`/consentimento?aceite=${encodeURIComponent(acceptanceId)}`}
            >
              Decidir sobre consentimento
            </Link>
          )}
        </div>
      </form>
      {mode === "consent" && grantId && (
        <div className="form-actions" style={{ marginTop: 24 }}>
          <button
            type="button"
            className="button button-secondary"
            onClick={revoke}
            disabled={pending}
          >
            Revogar consentimento
          </button>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiGet, apiPost, describeError, initials, personName, relativeTime, type Invitation, type Notice } from "../../lib/client/api";
import { useRadar } from "../../lib/client/radar";
import { useSearchParams } from "next/navigation";
import { ShareStudio } from "./ShareStudio";
import { useShell } from "./AppShell";

export function Requests() {
  const { session, toast } = useShell();
  const radar = useRadar(session.userId);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [consenting, setConsenting] = useState<Invitation | null>(null);
  const params = useSearchParams();
  useEffect(() => {
    if (params.get("desafio") === "aceito") toast("Desafio aceito. O pedido foi enviado; você poderá prever quando a pessoa consentir.");
  }, [params, toast]);

  if (radar.loading) return <div className="skeleton" style={{ height: 320 }} aria-busy="true" />;
  const me = session.userId!;
  const incoming = radar.invitations.filter((i) => i.targetId === me).sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
  const outgoing = radar.invitations.filter((i) => i.predictorId === me).sort((a, b) => b.invitedAt.localeCompare(a.invitedAt));
  const grantFor = (inv: Invitation) => radar.consents.find((c) => c.purpose === "BE_PREDICTED" && c.invitationAcceptanceId === inv.acceptanceId && !c.revokedAt);
  const canPredict = (targetId: string) => radar.opportunities.some((o) => o.targetId === targetId);
  const answeredAll = radar.questions.length > 0 && radar.questions.every((q) => radar.answers.has(q.questionVersionId));

  const send = async () => {
    setSending(true);
    try {
      await apiPost("/radar/invitations", { email: email.trim() });
      toast("Pedido enviado. A pessoa verá na tela de pedidos dela.");
      setEmail("");
      await radar.reload();
    } catch (error) {
      const text = describeError(error);
      toast(text.startsWith("Não encontramos") ? "Não há conta ativa com esse e-mail. Peça para a pessoa criar uma conta." : text, "error");
    } finally { setSending(false); }
  };

  // One click: accept the request, then go straight into reading the notice
  // and consenting — no separate step, and no waiting on a full reload to
  // see the invitation move forward.
  const acceptAndConsent = async (inv: Invitation) => {
    try {
      const result = await apiPost<{ acceptanceId: string }>(`/radar/invitations/${inv.id}/accept`, {});
      setConsenting({ ...inv, acceptanceId: result.acceptanceId, acceptedAt: new Date().toISOString() });
    } catch (error) { toast(describeError(error), "error"); }
  };

  const revoke = async (grantId: string) => {
    try {
      await apiPost(`/radar/consents/${grantId}/revoke`, {});
      toast("Consentimento revogado. As previsões dessa pessoa deixaram de ser visíveis.");
      await radar.reload();
    } catch (error) { toast(describeError(error), "error"); }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="display">Pedidos</h1>
          <p>Quem quer prever você envia um pedido. Você aceita e lê o aviso de uma vez; pode revogar quando quiser depois.</p>
        </div>
      </div>

      <ShareStudio questions={radar.questions} answered={radar.answers.size} />

      {consenting && (
        <ConsentPanel invitation={consenting} name={personName(radar.people, consenting.predictorId)} hasAnswers={radar.answers.size > 0}
          onClose={() => setConsenting(null)}
          onDone={async () => { setConsenting(null); await radar.reload(); }} />
      )}

      <div className="grid-main">
        <section className="card" data-p="people" aria-labelledby="in-title">
          <div className="row-between"><h2 id="in-title">Pedidos para prever você</h2><span className="tag" data-p="people">{incoming.length}</span></div>
          {!answeredAll && (
            <p className="form-message" style={{ marginTop: 16 }}>Complete o seu gabarito para que os pedidos aceitos possam virar previsões. <Link className="text-link" href="/onboarding">Responder agora</Link></p>
          )}
          {incoming.length === 0 ? (
            <div className="empty" style={{ marginTop: 16 }}>
              <strong>Nenhum pedido ainda.</strong>
              <span>Passe o seu e-mail para alguém que te conhece bem. É por ele que a pessoa te encontra aqui.</span>
            </div>
          ) : (
            <ul className="list" style={{ marginTop: 8 }}>
              {incoming.map((inv) => {
                const grant = grantFor(inv);
                const name = personName(radar.people, inv.predictorId);
                return (
                  <li key={inv.id}>
                    <span className="avatar" data-p="people">{initials(name)}</span>
                    <div className="grow">
                      <strong>{name}</strong>
                      <div className="faint" style={{ fontSize: 14 }}>
                        {grant ? `Consentido ${relativeTime(grant.grantedAt)} · ${grant.scope === "SHARED" ? "você vê as previsões" : "só a pessoa vê"}`
                          : inv.acceptanceId ? "Aceito, aguardando seu consentimento" : `Pediu ${relativeTime(inv.invitedAt)}`}
                      </div>
                    </div>
                    {!inv.acceptanceId && <button className="button button-small" data-p="people" onClick={() => void acceptAndConsent(inv)}>Aceitar e consentir</button>}
                    {inv.acceptanceId && !grant && <button className="button button-small" data-p="people" onClick={() => setConsenting(inv)}>Ler aviso e consentir</button>}
                    {grant && <button className="button button-small button-danger" onClick={() => void revoke(grant.id)}>Revogar</button>}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <div className="stack">
          <section className="card lit" data-p="people" aria-labelledby="send-title">
            <h2 id="send-title">Pedir para prever alguém</h2>
            <p className="muted" style={{ marginTop: 8 }}>Use o e-mail com que a pessoa entra no ORVOK. Você precisa ter respondido o seu próprio gabarito para prever.</p>
            <form className="form-stack" style={{ marginTop: 16 }} onSubmit={(event) => { event.preventDefault(); void send(); }}>
              <label className="field"><span>E-mail da pessoa</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nome@exemplo.com" autoComplete="off" />
              </label>
              <div className="form-actions"><button className="button" data-p="people" disabled={sending || !email.includes("@")}>{sending ? "Enviando…" : "Enviar pedido"}</button></div>
            </form>
          </section>

          <section className="card" aria-labelledby="out-title">
            <h2 id="out-title">Pedidos que você enviou</h2>
            {outgoing.length === 0 ? <p className="muted" style={{ marginTop: 12 }}>Nenhum pedido enviado.</p> : (
              <ul className="list" style={{ marginTop: 8 }}>
                {outgoing.map((inv) => {
                  const name = personName(radar.people, inv.targetId);
                  const ready = canPredict(inv.targetId);
                  return (
                    <li key={inv.id}>
                      <span className="avatar" data-p="people">{initials(name)}</span>
                      <div className="grow">
                        <strong>{name}</strong>
                        <div className="faint" style={{ fontSize: 14 }}>{ready ? "Pronta para ser prevista" : inv.acceptanceId ? "Aceitou; aguardando consentimento ou gabarito" : "Aguardando aceite"}</div>
                      </div>
                      {ready && <Link className="button button-small" data-p="people" href={`/previsao?pessoa=${inv.targetId}`}>Prever</Link>}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

function ConsentPanel({ invitation, name, hasAnswers, onClose, onDone }: {
  invitation: Invitation; name: string; hasAnswers: boolean; onClose: () => void; onDone: () => void | Promise<void>;
}) {
  const { toast } = useShell();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [scope, setScope] = useState<"SHARED" | "PRIVATE">("SHARED");
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    apiGet<Notice>(`/consent-notice?purpose=BE_PREDICTED&acceptanceId=${invitation.acceptanceId}`)
      .then(setNotice).catch((error) => toast(describeError(error), "error"));
  }, [invitation.acceptanceId, toast]);

  const grant = async () => {
    if (!notice) return;
    setPending(true);
    try {
      await apiPost("/radar/consents", {
        acceptanceId: invitation.acceptanceId, presentationId: notice.presentationId, accepted: true,
        noticeVersion: notice.version, noticeHash: notice.contentHash, scope,
      });
      if (hasAnswers) await apiPost("/radar/answers/reconfirm", {});
      toast(hasAnswers ? `${name} já pode te prever. Seu gabarito foi reconfirmado para esta previsão.` : `Consentimento registrado. Responda o gabarito para ${name} poder te prever.`);
      await onDone();
    } catch (error) { toast(describeError(error), "error"); } finally { setPending(false); }
  };

  return (
    <section className="card" data-p="people" style={{ marginBottom: 16, borderColor: "var(--line-strong)" }} aria-labelledby="consent-title">
      <div className="row-between">
        <h2 id="consent-title">Consentir que {name} preveja você</h2>
        <button className="text-link" onClick={onClose}>Fechar</button>
      </div>
      {!notice ? <div className="skeleton" style={{ height: 120, marginTop: 16 }} /> : (
        <div className="grid-2" style={{ marginTop: 16, alignItems: "start" }}>
          <div>
            <span className="tag">Aviso versão {notice.version}</span>
            <div className="muted" style={{ whiteSpace: "pre-wrap", marginTop: 12, maxHeight: 240, overflow: "auto" }} tabIndex={0}>{notice.content}</div>
          </div>
          <div className="form-stack">
            <fieldset className="options" style={{ border: 0, padding: 0, margin: 0 }}>
              <legend className="eyebrow">Quem vê as previsões</legend>
              <label className="option" data-p="people" style={{ ["--self" as string]: "var(--people)" }}>
                <input type="radio" name="scope" checked={scope === "SHARED"} onChange={() => setScope("SHARED")} />
                <span className="key">1</span><span><strong>Eu e {name}</strong><br /><span className="faint">Você verá o encontro com as previsões dessa pessoa.</span></span>
              </label>
              <label className="option" data-p="people" style={{ ["--self" as string]: "var(--people)" }}>
                <input type="radio" name="scope" checked={scope === "PRIVATE"} onChange={() => setScope("PRIVATE")} />
                <span className="key">2</span><span><strong>Só {name}</strong><br /><span className="faint">Você autoriza, mas não acompanha o resultado.</span></span>
              </label>
            </fieldset>
            <label className="checkbox-row"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />Li o aviso e consinto.</label>
            <div className="form-actions"><button className="button" data-p="people" disabled={!agreed || pending} onClick={() => void grant()}>{pending ? "Registrando…" : "Consentir"}</button></div>
          </div>
        </div>
      )}
    </section>
  );
}

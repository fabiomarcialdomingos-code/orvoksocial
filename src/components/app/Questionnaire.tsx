"use client";
/* eslint-disable react-hooks/set-state-in-effect -- data loading effects set state from API responses (same convention as CommandCenter). */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, describeError, type Notice, type Profile } from "../../lib/client/api";
import { useRadar } from "../../lib/client/radar";
import { useShell } from "./AppShell";

const KEYS = ["A", "B", "C", "D", "E", "F"];

export function Questionnaire() {
  const { session, profile, setProfile, toast } = useShell();
  const radar = useRadar(session.userId);
  const [index, setIndex] = useState(0);
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const firstOpen = useMemo(() => radar.questions.findIndex((q) => !radar.answers.has(q.questionVersionId)), [radar.questions, radar.answers]);
  useEffect(() => { if (!radar.loading && firstOpen > 0) setIndex(firstOpen); }, [radar.loading, firstOpen]);

  if (radar.loading) return <div className="skeleton" style={{ height: 320 }} aria-busy="true" />;
  if (radar.error) return <div className="empty"><strong>A referência não carregou.</strong><span>{radar.error}</span></div>;
  if (!profile) return <NameStep onSaved={setProfile} />;
  if (!radar.selfGrant) return <SelfConsent onGranted={() => void radar.reload()} />;
  if (!radar.questions.length) return <div className="empty"><strong>Nenhuma pergunta publicada ainda.</strong><span>O catálogo do Radar precisa ser aprovado por um administrador.</span></div>;

  const total = radar.questions.length;
  const answered = radar.questions.filter((q) => radar.answers.has(q.questionVersionId)).length;
  if (done || (answered === total && index >= total)) return <Finished answered={answered} total={total} onReview={() => { setDone(false); setIndex(0); }} />;

  const question = radar.questions[Math.min(index, total - 1)]!;
  const current = radar.answers.get(question.questionVersionId);

  const choose = async (optionId: string) => {
    if (saving) return;
    if (current?.optionId === optionId) { next(); return; }
    setSaving(true);
    try {
      const result = await apiPost<{ answerVersionId: string; version: number }>("/radar/answers", {
        questionVersionId: question.questionVersionId, optionId, consentGrantId: radar.selfGrant!.id,
        ...(current ? { supersedesId: current.id } : {}),
      });
      radar.setAnswer({ id: result.answerVersionId, questionVersionId: question.questionVersionId, optionId, version: result.version, answeredAt: new Date().toISOString() });
      next();
    } catch (error) {
      toast(describeError(error), "error");
    } finally {
      setSaving(false);
    }
  };
  const next = () => {
    if (index + 1 >= total) setDone(true); else setIndex(index + 1);
  };

  return (
    <div className="quiz">
      <section className="quiz-question" aria-labelledby="q-title">
        <div className="quiz-progress" aria-label={`Pergunta ${index + 1} de ${total}`}>
          {radar.questions.map((q, i) => <i key={q.questionVersionId} data-on={radar.answers.has(q.questionVersionId) || i === index} />)}
        </div>
        <span className="eyebrow">Pergunta {index + 1} de {total}</span>
        <h1 id="q-title" className="display">{question.text}</h1>
        <p className="muted" style={{ marginTop: 16 }}>Responda pelo que você costuma fazer, não pelo que gostaria. Quem prevê você nunca vê esta resposta.</p>
        <div className="row" style={{ marginTop: 32 }}>
          <button type="button" className="button button-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>Voltar</button>
          {current && <button type="button" className="text-link" onClick={next}>Manter resposta e seguir</button>}
        </div>
      </section>
      <section aria-label="Opções">
        <div className="options" role="radiogroup" aria-labelledby="q-title"
          onKeyDown={(event) => {
            const k = KEYS.indexOf(event.key.toUpperCase());
            const n = Number(event.key) - 1;
            const pick = k >= 0 ? k : n;
            if (pick >= 0 && question.options[pick]) void choose(question.options[pick].id);
          }}>
          {question.options.map((option, i) => (
            <button key={option.id} type="button" role="radio" className="option lit" data-p="self"
              aria-checked={current?.optionId === option.id} disabled={saving} onClick={() => void choose(option.id)}>
              <span className="key">{KEYS[i]}</span>
              <span>{option.label}</span>
            </button>
          ))}
        </div>
        <p className="faint" style={{ marginTop: 16, fontSize: 14 }}>Dica: use as teclas A, B, C ou D.</p>
      </section>
    </div>
  );
}

function NameStep({ onSaved }: { onSaved: (profile: Profile) => void }) {
  const { toast } = useShell();
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  return (
    <div className="quiz">
      <section className="quiz-question">
        <span className="eyebrow">Antes de começar</span>
        <h1 className="display">Como as pessoas vão te reconhecer aqui?</h1>
        <p className="muted" style={{ marginTop: 16 }}>Use o nome pelo qual seus amigos te chamam. Ele aparece nos pedidos que você envia e recebe.</p>
      </section>
      <form className="card form-stack" onSubmit={async (event) => {
        event.preventDefault();
        setPending(true);
        try {
          const result = await apiPost<{ profile: Profile }>("/social/profile", { displayName: name.trim() });
          onSaved(result.profile);
        } catch (error) { toast(describeError(error), "error"); } finally { setPending(false); }
      }}>
        <label className="field"><span>Seu nome</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required maxLength={120} autoFocus placeholder="Ex.: Fabio Marcial" />
        </label>
        <div className="form-actions"><button className="button" data-p="self" disabled={pending || !name.trim()}>Continuar</button></div>
      </form>
    </div>
  );
}

function SelfConsent({ onGranted }: { onGranted: () => void }) {
  const { toast } = useShell();
  const [notice, setNotice] = useState<Notice | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);
  useEffect(() => {
    apiGet<Notice>("/consent-notice?purpose=SELF_ANSWER").then(setNotice).catch((error) => setFailed(describeError(error)));
  }, []);
  return (
    <div className="quiz">
      <section className="quiz-question">
        <span className="eyebrow">Etapa 1 de 2</span>
        <h1 className="display">Suas respostas, guardadas do seu jeito.</h1>
        <p className="muted" style={{ marginTop: 16 }}>Para montar a sua referência precisamos do seu consentimento. Você pode revogá-lo depois em Privacidade e dados.</p>
      </section>
      <div className="card form-stack">
        {failed && <p className="form-message" data-kind="error">{failed}</p>}
        {!notice && !failed && <div className="skeleton" style={{ height: 120 }} />}
        {notice && (
          <>
            <div className="row-between"><h3>Aviso de respostas próprias</h3><span className="tag">versão {notice.version}</span></div>
            <div className="muted" style={{ whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }} tabIndex={0}>{notice.content}</div>
            <label className="checkbox-row"><input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />Li o aviso e concordo em registrar minhas respostas.</label>
            <div className="form-actions">
              <button className="button" data-p="self" disabled={!agreed || pending} onClick={async () => {
                setPending(true);
                try {
                  await apiPost("/radar/self-answer-consents", { presentationId: notice.presentationId, accepted: true, noticeVersion: notice.version, noticeHash: notice.contentHash });
                  onGranted();
                } catch (error) { toast(describeError(error), "error"); } finally { setPending(false); }
              }}>Concordar e começar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Finished({ answered, total, onReview }: { answered: number; total: number; onReview: () => void }) {
  return (
    <div className="quiz">
      <section className="quiz-question">
        <span className="eyebrow">Referência completa</span>
        <h1 className="display">Pronto. Agora é a vez de quem te conhece.</h1>
        <p className="muted" style={{ marginTop: 16 }}>Você respondeu {answered} de {total} perguntas. Compartilhe seu e-mail com quem quiser te prever: a pessoa envia um pedido e você decide se aceita.</p>
        <div className="hero-actions">
          <Link href="/convites" className="button" data-p="people">Ver pedidos</Link>
          <button type="button" className="button button-secondary" onClick={onReview}>Revisar respostas</button>
        </div>
      </section>
      <div className="card" data-p="self">
        <h3>Enquanto isso</h3>
        <ul className="list" style={{ marginTop: 8 }}>
          <li><span className="dot" style={{ background: "var(--people)" }} /><span className="grow">Peça para prever alguém que você conhece bem.</span><Link className="text-link" href="/convites">Pedir</Link></li>
          <li><span className="dot" style={{ background: "var(--world)" }} /><span className="grow">Faça sua primeira previsão sobre o mundo.</span><Link className="text-link" href="/eventos">Abrir eventos</Link></li>
        </ul>
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";

type Request = { id: string; type: string; status: string; requestedAt: string };

export function DataRightsPanel() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmErasure, setConfirmErasure] = useState(false);

  async function load() {
    try {
      const response = await fetch("/api/v1/me/data-requests", { credentials: "same-origin", cache: "no-store" });
      if (!response.ok) throw new Error("Não foi possível carregar solicitações.");
      const data = (await response.json()) as { items: Request[] };
      setRequests(data.items);
      setError("");
    } catch {
      setError("Não foi possível carregar solicitações. Faça login ou tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { queueMicrotask(() => { void load(); }); }, []);

  async function requestAction(type: "EXPORT" | "ERASURE") {
    setBusy(true);
    setError("");
    setConfirmation("");
    try {
      const path = type === "EXPORT" ? "/api/v1/me/export-requests" : "/api/v1/me/erasure-requests";
      const response = await fetch(path, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: "{}",
      });
      if (!response.ok) throw new Error("Não foi possível registrar a solicitação.");
      const data = (await response.json()) as { requestId: string; state: string };
      setConfirmation(`Solicitação ${data.requestId} recebida · ${data.state}.`);
      setConfirmErasure(false);
      setLoading(true);
      await load();
    } catch {
      setError("Não foi possível registrar a solicitação. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="form-stack">
    <h2 className="display">Acesso e solicitações</h2>
    <p>A exportação técnica inclui os dados disponíveis para sua conta. Registros de terceiros permanecem protegidos.</p>
    <div className="form-actions">
      <a className="button button-secondary" href="/api/v1/me/export" download>Baixar meus dados</a>
      <button type="button" className="button button-secondary" disabled={busy} onClick={() => void requestAction("EXPORT")}>Solicitar exportação</button>
    </div>
    <fieldset>
      <legend>Solicitação de exclusão</legend>
      <p>A solicitação será registrada para tratamento controlado. A exclusão não é automática nesta etapa.</p>
      <label className="checkbox-row"><input type="checkbox" checked={confirmErasure} onChange={(event) => setConfirmErasure(event.target.checked)} />Entendo que estou solicitando análise e processamento de exclusão dos meus dados.</label>
      <button type="button" className="button" disabled={!confirmErasure || busy} onClick={() => void requestAction("ERASURE")}>{busy ? "Aguarde…" : "Solicitar exclusão"}</button>
    </fieldset>
    {confirmation && <p className="form-message" role="status">{confirmation}</p>}
    {error && <p className="form-message" data-kind="error" role="alert">{error}</p>}
    <h3>Histórico de solicitações</h3>
    {loading ? <p role="status">Carregando solicitações…</p> : requests.length ? <ul className="radar-list">{requests.map((item) => <li key={item.id}>{item.type} · {item.status} · {new Date(item.requestedAt).toLocaleDateString("pt-BR")}</li>)}</ul> : <p className="radar-empty" role="status">Nenhuma solicitação registrada.</p>}
  </div>;
}

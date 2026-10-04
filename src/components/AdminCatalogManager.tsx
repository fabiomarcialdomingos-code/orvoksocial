"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import { useEffect, useState } from "react";

type Event = { id: string; title: string; category: string; status: string; opensAt: string; closesAt: string; opportunities: { label: string }[] };

async function read<T>(url: string): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { code?: string; message?: string; error?: { message?: string } } | null;
    if (response.status === 401 || payload?.code === "UNAUTHENTICATED") throw new Error("Faça login para acessar os pré-cadastros.");
    if (response.status === 403 || payload?.code === "FORBIDDEN") throw new Error("Esta conta não tem permissão de administrador.");
    throw new Error(payload?.message ?? payload?.error?.message ?? "Não foi possível carregar os pré-cadastros.");
  }
  return response.json() as Promise<T>;
}

async function write(url: string, body: unknown) {
  const response = await fetch(url, { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() }, body: JSON.stringify(body) });
  if (!response.ok) {
    const payload = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(payload?.error?.message ?? "Operação administrativa recusada.");
  }
  return response.json();
}

export function AdminCatalogManager() {
  const [events, setEvents] = useState<Event[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function load() {
    setLoading(true); setError(null);
    try {
      const eventResult = await read<{ items: Event[] }>("/api/v1/world/events?status=DRAFT");
      setEvents(eventResult.items); setNotice(`Pré-cadastros atualizados às ${new Date().toLocaleTimeString("pt-BR")}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao carregar o catálogo."); }
    finally { setLoading(false); }
  }

  useEffect(() => { void load(); }, []);

  async function publish(url: string, message: string) {
    try { await write(url, { reason: "Publicação revisada nos pré-cadastros." }); setNotice(message); await load(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível publicar o item."); }
  }

  return <div className="social-main" style={{padding:0}}>
    <div className="social-heading"><div><span className="eyebrow">Catálogo administrativo</span><h1 className="display">Pré-cadastros</h1><p className="muted">Revise os eventos antes de disponibilizá-los no Mundo.</p></div><button className="button" type="button" onClick={() => void load()} disabled={loading} aria-busy={loading}>{loading ? "Atualizando…" : "Atualizar"}</button></div>
    {error && <p className="form-message" data-kind="error" role="alert">{error}</p>}{notice && <p className="form-message" role="status">{notice}</p>}
    <section className="social-card"><header className="social-section-title"><span className="eyebrow">Eventos</span><h2>{error ? "—" : events.length} pré-cadastrados</h2></header><div className="table-wrap"><table><thead><tr><th>Evento</th><th>Categoria</th><th>Estado</th><th>Ações</th></tr></thead><tbody>{events.map((event) => <tr key={event.id}><td>{event.title}</td><td>{event.category}</td><td><span className="status-pill">{event.status}</span></td><td><button className="text-link" type="button" onClick={() => void publish(`/api/v1/admin/events/${event.id}/publish`, "Evento publicado.")}>Publicar</button></td></tr>)}</tbody></table></div></section>
  </div>;
}

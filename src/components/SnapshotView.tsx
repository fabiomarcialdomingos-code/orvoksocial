"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Snapshot = {
  id: string;
  predictorId: string;
  targetId: string;
  questionVersionId: string;
  probabilityVector: number[];
  predictedAt: string;
  consentVersion: number;
  snapshotHash: string;
};

export function SnapshotView({ id }: { id: string }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/v1/radar/snapshots/${encodeURIComponent(id)}`, { credentials: "same-origin", cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("UNAVAILABLE");
        return response.json() as Promise<{ snapshot: Snapshot }>;
      })
      .then((data) => { if (!controller.signal.aborted) { setSnapshot(data.snapshot); setState("ready"); } })
      .catch(() => { if (!controller.signal.aborted) setState("error"); });
    return () => controller.abort();
  }, [id]);
  return <section aria-labelledby="snapshot-title">
    <h2 id="snapshot-title" className="display">Snapshot</h2>
    {state === "loading" && <p role="status">Carregando registro…</p>}
    {state === "error" && <p role="alert">Registro indisponível ou acesso revogado.</p>}
    {state === "ready" && snapshot && <dl className="radar-record"><div><dt>Identificador</dt><dd>{snapshot.id}</dd></div><div><dt>Hash do snapshot</dt><dd>{snapshot.snapshotHash}</dd></div><div><dt>Previsão registrada em</dt><dd>{new Date(snapshot.predictedAt).toLocaleString("pt-BR")}</dd></div><div><dt>Versão do consentimento</dt><dd>{snapshot.consentVersion}</dd></div><div><dt>Pergunta de teste</dt><dd>{snapshot.questionVersionId}</dd></div><div><dt>Distribuição registrada</dt><dd>{snapshot.probabilityVector.map((value) => `${Math.round(value * 1000) / 10}%`).join(" · ")}</dd></div></dl>}
    <Link className="text-link" href="/radar">Voltar ao Radar</Link>
  </section>;
}

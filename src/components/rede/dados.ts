"use client";
import { useEffect, useState } from "react";

export type Relacao = "familia" | "amigos" | "crush";
export type Tentativa = { nome: string | null; em: string; score?: number; total?: number };
export type Enviado = { codigo: string; criadoEm: string; relacao: Relacao; nome: string; tentativas: Tentativa[] };
export type Recebido = { codigo: string; nome: string; relacao: Relacao; acertos: number; total: number; em: string };
export const ROTULO_RELACAO: Record<Relacao, string> = { familia: "Família", amigos: "Amigos", crush: "Crush" };

/** Desafios enviados e recebidos da conta (e do aparelho). */
export function useDesafios() {
  const [dados, setDados] = useState<{ enviados: Enviado[]; recebidos: Recebido[] } | null>(null);
  const [versao, setVersao] = useState(0);
  useEffect(() => {
    let ativo = true;
    void (async () => {
      const [m, r] = await Promise.all([
        fetch("/api/v1/desafio/meus", { credentials: "same-origin", cache: "no-store" }).then((x) => (x.ok ? x.json() : { desafios: [] })).catch(() => ({ desafios: [] })),
        fetch("/api/v1/desafio/recebidos", { credentials: "same-origin", cache: "no-store" }).then((x) => (x.ok ? x.json() : { itens: [] })).catch(() => ({ itens: [] })),
      ]) as [{ desafios: Enviado[] }, { itens: Recebido[] }];
      if (ativo) setDados({ enviados: m.desafios ?? [], recebidos: r.itens ?? [] });
    })();
    return () => { ativo = false; };
  }, [versao]);
  return { dados, recarregar: () => setVersao((v) => v + 1) };
}

export function quando(valor: string): string {
  const diff = (new Date(valor).getTime() - Date.now()) / 1000;
  const rtf = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return "agora";
  if (abs < 3600) return rtf.format(Math.round(diff / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(diff / 3600), "hour");
  return rtf.format(Math.round(diff / 86400), "day");
}

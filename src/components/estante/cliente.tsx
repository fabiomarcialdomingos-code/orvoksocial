"use client";
/* As fotos e os desenhos são privados e vêm de rotas com autorização: não passam pelo otimizador de imagens. */
/* eslint-disable @next/next/no-img-element */
import { useEffect, useState } from "react";
import { ILUSTRACAO_PADRAO } from "@/lib/estante/svg";
import e from "./estante.module.css";

export const COR = "#FFB84D";

const MENSAGENS: Record<string, string> = {
  CONTENT_REJECTED: "Isso não passou na nossa checagem. Tente outro texto ou outra foto.",
  SERVICE_UNAVAILABLE: "A checagem está fora do ar agora. Tente de novo em instantes.",
  RATE_LIMITED: "Foram muitas tentativas por hoje. Tente de novo amanhã.",
  AGE_REQUIRED: "Confirme que você tem 16 anos ou mais para continuar.",
  FORBIDDEN: "Isso não está disponível para você.",
  CONFLICT: "Isso não é possível agora.",
  NOT_FOUND: "Não encontramos isso.",
  PAYLOAD_TOO_LARGE: "A foto é grande demais.",
  INVALID_INPUT: "Confira os campos e tente de novo.",
  UNAUTHENTICATED: "Crie a sua estante primeiro.",
};
export class ErroApi extends Error { constructor(public readonly codigo: string) { super(codigo); } get texto() { return MENSAGENS[this.codigo] ?? "Algo deu errado. Tente de novo."; } }

export async function chamar<T = Record<string, unknown>>(caminho: string, opcoes: { metodo?: "GET" | "POST"; corpo?: unknown; bruto?: Blob } = {}): Promise<T> {
  const metodo = opcoes.metodo ?? (opcoes.corpo !== undefined || opcoes.bruto ? "POST" : "GET");
  const r = await fetch(`/api/v1/estante/${caminho}`, {
    method: metodo, credentials: "same-origin", cache: "no-store",
    ...(opcoes.bruto ? { body: opcoes.bruto } : opcoes.corpo !== undefined ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(opcoes.corpo) } : metodo === "POST" ? { headers: { "Content-Type": "application/json" }, body: "{}" } : {}),
  }).catch(() => null);
  if (!r) throw new ErroApi("SERVICE_UNAVAILABLE");
  const d = (await r.json().catch(() => ({}))) as T & { code?: string };
  if (!r.ok) throw new ErroApi(d.code ?? "INTERNAL_ERROR");
  return d;
}

/** O desenho vira uma imagem (data URI): dentro de <img> um SVG nunca executa script. */
export function urlDoDesenho(svg: string | null | undefined): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent((svg ?? ILUSTRACAO_PADRAO).replaceAll("currentColor", COR))}`;
}
export const urlDaFoto = (id: string, baixar = false) => `/api/v1/estante/imagens/${id}${baixar ? "?baixar=1" : ""}`;

export function Desenho({ svg, titulo, grande }: { svg: string | null | undefined; titulo: string; grande?: boolean }) {
  return <img className={grande ? e.desenhoGrande : e.desenho} src={urlDoDesenho(svg)} alt={titulo} width={grande ? 160 : 72} height={grande ? 160 : 72} />;
}
export function Avatar({ id, nome, tamanho = 44 }: { id: string | null | undefined; nome: string; tamanho?: number }) {
  const [falhou, setFalhou] = useState(false);
  if (id && !falhou) {
    return <img className={e.avatar} style={{ width: tamanho, height: tamanho }} src={urlDaFoto(id)} alt={nome} onError={() => setFalhou(true)} />;
  }
  return <span className={e.avatarIni} style={{ width: tamanho, height: tamanho, fontSize: tamanho * 0.42 }} aria-label={nome}>{nome.trim().charAt(0).toUpperCase() || "?"}</span>;
}

/** Reduz a foto no aparelho antes de enviar (cabe no limite de envio e já tira a localização). */
export async function reduzirFoto(arquivo: File, lado: number): Promise<Blob> {
  const bmp = await createImageBitmap(arquivo);
  const escala = Math.min(1, lado / Math.max(bmp.width, bmp.height));
  const tela = document.createElement("canvas");
  tela.width = Math.max(1, Math.round(bmp.width * escala)); tela.height = Math.max(1, Math.round(bmp.height * escala));
  tela.getContext("2d")!.drawImage(bmp, 0, 0, tela.width, tela.height);
  for (const q of [0.88, 0.75, 0.6]) {
    const b = await new Promise<Blob | null>((ok) => tela.toBlob(ok, "image/jpeg", q));
    if (b && b.size < 2_500_000) return b;
  }
  throw new ErroApi("PAYLOAD_TOO_LARGE");
}

export function useMensagem() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { if (!msg) return; const t = setTimeout(() => setMsg(null), 5000); return () => clearTimeout(t); }, [msg]);
  return [msg, setMsg] as const;
}

export const NOTAS = [
  { n: 1, r: "Pouco" }, { n: 2, r: "Um pouco" }, { n: 3, r: "Gostou" }, { n: 4, r: "Gostou muito" }, { n: 5, r: "Adorou" },
] as const;
export function Escala({ valor, aoEscolher, desativado }: { valor: number | null; aoEscolher: (n: number) => void; desativado?: boolean }) {
  return (
    <div className={e.escala} role="radiogroup">
      {NOTAS.map((x) => (
        <button key={x.n} type="button" role="radio" aria-checked={valor === x.n} disabled={desativado} className={`${e.nota} ${valor === x.n ? e.notaSel : ""}`} onClick={() => aoEscolher(x.n)}>
          <b>{x.n}</b><small>{x.r}</small>
        </button>
      ))}
    </div>
  );
}

/** Mensagem pronta para mandar por WhatsApp. */
export const linkWhatsApp = (texto: string) => `https://wa.me/?text=${encodeURIComponent(texto)}`;
export const origem = () => (typeof window === "undefined" ? "" : window.location.origin);

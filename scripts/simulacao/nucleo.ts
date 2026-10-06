/* eslint-disable @typescript-eslint/no-explicit-any */
// Núcleo da simulação: cliente HTTP com cookies, registro de cada requisição, verificações e achados.
// Nunca registra valor de cookie, token ou senha: só nomes e atributos de cookie.
import { Pool } from "pg";

export const BASE = (process.env.SIM_BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
export const ORIGEM = new URL(BASE).origin;
export const RUN = process.env.SIM_RUN ?? Date.now().toString(36);
export const SENHA = "Sim#Senha2026x";
export const SENHA_NOVA = "Sim#Outra2026y";
export const emailDe = (n: number) => `sim30-${RUN}-${String(n).padStart(2, "0")}@orvok.test`;
export const nomeDe = (n: number) => `SIM ${String(n).padStart(2, "0")}`;

export type Req = { f: string; u: string; m: string; p: string; s: number; ms: number; c?: string };
export const requisicoes: Req[] = [];
export type Resultado = { fase: string; nome: string; ok: boolean; detalhe: string };
export const resultados: Resultado[] = [];
export type Sev = "critico" | "alto" | "medio" | "baixo" | "info";
export const achados: { sev: Sev; fase: string; titulo: string; detalhe: string }[] = [];
export const cookiesAuditados = new Map<string, string>();
export let faseAtual = "";
export const fase = (nome: string) => { faseAtual = nome; console.log(`\n== ${nome}`); };
export function verificar(nome: string, ok: boolean, detalhe = ""): boolean {
  resultados.push({ fase: faseAtual, nome, ok, detalhe });
  console.log(`${ok ? "ok    " : "FALHA "} ${nome}${detalhe && !ok ? ` — ${detalhe}` : ""}`);
  return ok;
}
export function achado(sev: Sev, titulo: string, detalhe: string): void {
  achados.push({ sev, fase: faseAtual, titulo, detalhe });
  console.log(`ACHADO[${sev}] ${titulo} — ${detalhe}`);
}

export class Ator {
  jar = new Map<string, string>();
  userId: string | null = null;
  senha = SENHA;
  dados: Record<string, any> = {};
  constructor(public nome: string, public tipo: "conta" | "convidado" | "anon", public email?: string) {}
  temCookie(prefixo: string) { return [...this.jar.keys()].some((k) => k.includes(prefixo)); }
}

const modelo = (p: string) => p.split("?")[0]!.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ":uuid").replace(/\/[A-Z0-9]{8}(?=\/|$)/g, "/:codigo");

export type Resp = { status: number; ms: number; json: any; texto: string; cab: Headers };
export async function http(u: Ator | null, metodo: string, caminho: string, o: { corpo?: unknown; raw?: string; ct?: string | null; origem?: string | null; cab?: Record<string, string>; semCookies?: boolean; timeout?: number } = {}): Promise<Resp> {
  const cab: Record<string, string> = { ...(o.cab ?? {}) };
  const escreve = ["POST", "PUT", "PATCH", "DELETE"].includes(metodo);
  if (escreve) {
    if (o.origem !== null) cab["Origin"] = o.origem ?? ORIGEM;
    if (o.ct !== null) cab["Content-Type"] = o.ct ?? "application/json";
  }
  if (u && !o.semCookies && u.jar.size) cab["Cookie"] = [...u.jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), o.timeout ?? 30_000);
  const ini = performance.now();
  let r: Response | null = null; let texto = "";
  try {
    r = await fetch(BASE + caminho, { method: metodo, headers: cab, ...(escreve ? { body: o.raw ?? JSON.stringify(o.corpo ?? {}) } : {}), redirect: "manual", signal: ctl.signal });
    texto = await r.text();
  } catch (e) {
    const ms = performance.now() - ini; clearTimeout(t);
    requisicoes.push({ f: faseAtual, u: u?.nome ?? "anon", m: metodo, p: modelo(caminho), s: 0, ms, c: "REDE" });
    return { status: 0, ms, json: null, texto: String((e as Error).message), cab: new Headers() };
  }
  clearTimeout(t);
  const ms = performance.now() - ini;
  let json: any = null; try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
  if (u) for (const sc of r.headers.getSetCookie()) {
    const [par, ...attrs] = sc.split(";").map((x) => x.trim()); const [nome, ...resto] = par!.split("="); const valor = resto.join("=");
    if (!valor || /max-age=0/i.test(attrs.join(";"))) u.jar.delete(nome!); else u.jar.set(nome!, valor);
    if (!cookiesAuditados.has(nome!)) cookiesAuditados.set(nome!, attrs.join("; "));
  }
  requisicoes.push({ f: faseAtual, u: u?.nome ?? "anon", m: metodo, p: modelo(caminho), s: r.status, ms, ...(json?.code ? { c: String(json.code) } : {}) });
  return { status: r.status, ms, json, texto, cab: r.headers };
}

export const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const pick = <T>(a: readonly T[], i: number): T => a[i % a.length]!;
export const embaralhar = <T>(a: T[], semente: number): T[] => { const x = [...a]; let s = semente; for (let i = x.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) & 0x7fffffff; const j = s % (i + 1); [x[i], x[j]] = [x[j]!, x[i]!]; } return x; };
export function pct(valores: number[], p: number): number { if (!valores.length) return 0; const s = [...valores].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!; }

export function conectarBanco(): Pool | null {
  const url = process.env.SIM_DATABASE_URL ?? process.env.DATABASE_URL;
  return url ? new Pool({ connectionString: url, max: 3 }) : null;
}

/** Contagem exata de linhas de todas as tabelas, para provar que a limpeza devolveu o banco ao que era. */
export async function contagens(db: Pool): Promise<Record<string, number>> {
  const tabs = (await db.query<{ t: string }>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`)).rows.map((r) => r.t);
  const out: Record<string, number> = {};
  for (const t of tabs) { try { out[t] = Number((await db.query(`SELECT count(*) AS n FROM "${t}"`)).rows[0].n); } catch { out[t] = -1; } }
  return out;
}

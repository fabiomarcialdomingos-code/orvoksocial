import { randomInt, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { randomToken, tokenHash } from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/session";
import { AVISO_HASH, AVISO_RETRATO_VERSAO, AVISO_VERSAO, CATALOGO_VERSAO, CODIGOS, MINIMO_RETRATO, perguntaPublica } from "./catalogo";
import { type Contexto } from "./banco";
import { NUCLEO } from "./nucleo";
import { media, notas, perfil, selo, type Notas } from "./perfil";
import {
  TOTAL_PERGUNTAS, conjuntoValido, escolherAberturaNucleo, escolherReforcoNucleo, perguntaPorChave, type Estatistica,
} from "./selecao";

const TOTAL = TOTAL_PERGUNTAS;
const DIAS_VALIDADE = 60;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const nome = z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(24));
const opcoes = z.array(z.enum(CODIGOS)).length(TOTAL);
const relacao = z.enum(["familia", "amigos", "crush"]);
export const criarSchema = z.strictObject({
  nome,
  relacao,
  perguntas: z.array(z.string().max(40)).length(TOTAL),
  respostas: opcoes,
  consentimento: z.strictObject({ aceito: z.literal(true), versao: z.literal(AVISO_VERSAO), hash: z.literal(AVISO_HASH) }),
}).refine((d) => conjuntoValido(d.perguntas, d.relacao), "conjunto inválido");
export const tentativaSchema = z.strictObject({ nome: nome.optional(), previsoes: opcoes, avisoRetrato: z.literal(AVISO_RETRATO_VERSAO).optional() });
const chavesNucleo = new Set(NUCLEO.map((p) => p.chave));
export const selecaoSchema = z.strictObject({
  relacao,
  ancoras: z.array(z.strictObject({ chave: z.string().refine((c) => chavesNucleo.has(c)), opcao: z.number().int().min(0).max(3) }))
    .length(6).refine((l) => new Set(l.map((a) => a.chave)).size === 6),
});
export const perfilSchema = z.strictObject({ perguntas: z.array(z.string().max(40)).length(TOTAL), respostas: opcoes }).refine((d) => conjuntoValido(d.perguntas));
const indice = (c: string) => CODIGOS.indexOf(c as (typeof CODIGOS)[number]);
export const codigoSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);

/** Cookie do aparelho: liga o visitante aos desafios e tentativas que ele fez. */
export function cookieConvidado(): string {
  return process.env.APP_ENV === "production" ? "__Host-orvok_convidado" : "orvok_convidado";
}
export function lerTokenConvidado(request: Request): string | null {
  for (const parte of (request.headers.get("cookie") ?? "").split(";")) {
    const [n, v] = parte.trim().split("=");
    if (n === cookieConvidado() && v && /^[A-Za-z0-9_-]{43}$/.test(v)) return v;
  }
  return null;
}
export function gravarTokenConvidado(response: Response, token: string): void {
  const secure = process.env.APP_ENV === "production" || process.env.APP_ORIGIN?.startsWith("https://") ? "; Secure" : "";
  response.headers.append("Set-Cookie", `${cookieConvidado()}=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=7776000${secure}`);
}

function novoCodigo(): string {
  let c = "";
  for (let i = 0; i < 8; i++) c += ALFABETO[randomInt(ALFABETO.length)];
  return c;
}

let cacheEstatisticas: { expira: number; dados: Map<string, Estatistica> } | null = null;

export class DesafioService {
  constructor(private readonly pool: Pool) {}

  private async limite(chave: string, max: number, segundos: number): Promise<void> {
    const r = await this.pool.query<{ attempts: number }>(
      `INSERT INTO "AuthRateLimit" ("keyHash",attempts,"resetsAt") VALUES ($1,1,clock_timestamp()+($2::int * interval '1 second'))
       ON CONFLICT ("keyHash") DO UPDATE SET
         attempts=CASE WHEN "AuthRateLimit"."resetsAt" <= clock_timestamp() THEN 1 ELSE "AuthRateLimit".attempts+1 END,
         "resetsAt"=CASE WHEN "AuthRateLimit"."resetsAt" <= clock_timestamp() THEN clock_timestamp()+($2::int * interval '1 second') ELSE "AuthRateLimit"."resetsAt" END
       RETURNING attempts`,
      [tokenHash(`rate:desafio:${chave}`), segundos],
    );
    if ((r.rows[0]?.attempts ?? max + 1) > max) throw new AuthError("RATE_LIMITED", 429);
  }

  /** Cria o desafio. Devolve o código público e o token do aparelho (novo ou o mesmo). */
  async criar(raw: unknown, tokenAtual: string | null, userId: string | null = null): Promise<{ codigo: string; token: string }> {
    const dados = criarSchema.parse(raw);
    const token = tokenAtual ?? randomToken();
    const dono = tokenHash(token);
    await this.limite("criar:global", 3000, 3600);
    await this.limite(`criar:${dono}`, 20, 86400);
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = novoCodigo();
      try {
        await this.pool.query(
          `INSERT INTO "GuestChallenge" (id,code,"creatorName","catalogVersion",answers,"questionKeys",relation,"consentNoticeVersion","consentNoticeHash","consentedAt","ownerTokenHash","expiresAt","claimedByUserId","claimedAt")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,$9,clock_timestamp(),$10,clock_timestamp()+($11::int * interval '1 day'),$12::uuid,CASE WHEN $12::uuid IS NULL THEN NULL ELSE clock_timestamp() END)`,
          [randomUUID(), codigo, dados.nome, CATALOGO_VERSAO, JSON.stringify(dados.respostas), JSON.stringify(dados.perguntas), dados.relacao, AVISO_VERSAO, AVISO_HASH, dono, DIAS_VALIDADE, userId],
        );
        return { codigo, token };
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
      }
    }
    throw new AuthError("CODE_COLLISION", 503);
  }

  private async ativo(codigo: string) {
    const r = await this.pool.query<{ id: string; creatorName: string; answers: string[]; questionKeys: string[]; relation: Contexto; ownerTokenHash: string }>(
      `SELECT id,"creatorName",answers,"questionKeys",relation,"ownerTokenHash" FROM "GuestChallenge"
        WHERE code=$1 AND "revokedAt" IS NULL AND "expiresAt">clock_timestamp()`,
      [codigoSchema.parse(codigo)],
    );
    const linha = r.rows[0];
    if (!linha || !conjuntoValido(linha.questionKeys)) throw new AuthError("NOT_FOUND", 404);
    return linha;
  }

  /** O que quem recebeu o convite pode ver: nome e perguntas. Nunca as respostas. */
  async vitrine(codigo: string, token: string | null) {
    const d = await this.ativo(codigo);
    const jaTentou = token
      ? await this.pool.query<{ score: number; total: number }>(
          `SELECT score,total FROM "GuestChallengeAttempt" WHERE "challengeId"=$1 AND "ownerTokenHash"=$2`, [d.id, tokenHash(token)])
      : null;
    return {
      nome: d.creatorName,
      relacao: d.relation,
      proprio: token ? tokenHash(token) === d.ownerTokenHash : false,
      perguntas: d.questionKeys.map((c) => perguntaPublica(perguntaPorChave(c)!, d.creatorName)),
      resultado: jaTentou?.rows[0] ?? null,
    };
  }

  /** Abertura: seis perguntas, uma de cada traço do perfil, adequadas à relação. */
  async ancoras(rel: Contexto) {
    return escolherAberturaNucleo(rel, await this.estatisticas()).map((p) => perguntaPublica(p));
  }

  /** Reforço: mais quatro perguntas nos traços em que a pessoa ficou mais em cima do muro. */
  async restantes(raw: unknown) {
    const { ancoras, relacao: rel } = selecaoSchema.parse(raw);
    return escolherReforcoNucleo(ancoras, rel, await this.estatisticas()).map((p) => perguntaPublica(p));
  }

  /** Diagnóstico "como você se vê", logo depois das perguntas. Não grava nada. */
  diagnostico(raw: unknown) {
    const d = perfilSchema.parse(raw);
    return perfil(notas(d.perguntas, d.respostas.map(indice)));
  }

  /** Mesmo conjunto de um desafio existente, para o "desafie de volta". */
  async conjuntoDe(codigo: string) {
    const d = await this.ativo(codigo);
    return { relacao: d.relation, perguntas: d.questionKeys.map((c) => perguntaPublica(perguntaPorChave(c)!)) };
  }

  /**
   * Aprendizado: para cada pergunta, quantas vezes os amigos acertaram e como as
   * respostas de quem se descreveu se espalham entre as opções. Últimos 180 dias,
   * guardado em memória por 10 minutos.
   */
  async estatisticas(): Promise<Map<string, Estatistica>> {
    if (cacheEstatisticas && cacheEstatisticas.expira > Date.now()) return cacheEstatisticas.dados;
    const r = await this.pool.query<{ chave: string; tentativas: number; acertos: number; a: number; b: number; c: number; d: number }>(
      `SELECT k.chave, count(*)::int AS tentativas, count(*) FILTER (WHERE pr.v = an.v)::int AS acertos,
              count(*) FILTER (WHERE an.v='A')::int AS a, count(*) FILTER (WHERE an.v='B')::int AS b,
              count(*) FILTER (WHERE an.v='C')::int AS c, count(*) FILTER (WHERE an.v='D')::int AS d
         FROM "GuestChallengeAttempt" t
         JOIN "GuestChallenge" g ON g.id = t."challengeId"
         CROSS JOIN LATERAL jsonb_array_elements_text(g."questionKeys") WITH ORDINALITY AS k(chave, i)
         JOIN LATERAL jsonb_array_elements_text(t.predictions) WITH ORDINALITY AS pr(v, j) ON pr.j = k.i
         JOIN LATERAL jsonb_array_elements_text(g.answers) WITH ORDINALITY AS an(v, m) ON an.m = k.i
        WHERE t."createdAt" > clock_timestamp() - interval '180 days'
        GROUP BY k.chave`,
    );
    const dados = new Map(r.rows.map((x) => [x.chave, { tentativas: x.tentativas, acertos: x.acertos, distribuicao: [x.a, x.b, x.c, x.d] as [number, number, number, number] }]));
    cacheEstatisticas = { expira: Date.now() + 10 * 60_000, dados };
    return dados;
  }

  /** Registra a tentativa e devolve só o placar. Uma tentativa por aparelho. */
  async tentar(codigo: string, raw: unknown, tokenAtual: string | null, userId: string | null = null) {
    const dados = tentativaSchema.parse(raw);
    const d = await this.ativo(codigo);
    const token = tokenAtual ?? randomToken();
    const dono = tokenHash(token);
    if (dono === d.ownerTokenHash) throw new AuthError("OWN_CHALLENGE", 409);
    await this.limite("tentar:global", 6000, 3600);
    await this.limite(`tentar:${dono}`, 60, 86400);
    const score = dados.previsoes.reduce((n, v, i) => n + (v === d.answers[i] ? 1 : 0), 0);
    const r = await this.pool.query<{ score: number; total: number }>(
      `INSERT INTO "GuestChallengeAttempt" (id,"challengeId","predictorName",predictions,score,total,"ownerTokenHash","claimedByUserId","portraitNoticeVersion")
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7,$8::uuid,$9)
       ON CONFLICT ("challengeId","ownerTokenHash") DO UPDATE SET "challengeId"=EXCLUDED."challengeId"
       RETURNING score,total`,
      [randomUUID(), d.id, dados.nome ?? null, JSON.stringify(dados.previsoes), score, TOTAL, dono, userId, dados.avisoRetrato ?? null],
    );
    return { ...r.rows[0]!, token };
  }

  /**
   * Desafios deste aparelho (e da conta, se houver). Sem conta, mostra só que
   * alguém respondeu; o placar aparece depois do cadastro, como combinado.
   */
  async meus(token: string | null, userId: string | null) {
    if (!token && !userId) return { desafios: [], logado: false };
    const r = await this.pool.query<{
      code: string; createdAt: Date; creatorName: string; relation: Contexto;
      tentativas: { nome: string | null; score: number; total: number; em: string }[] | null;
    }>(
      `SELECT c.code,c."createdAt",c."creatorName",c.relation,
              (SELECT jsonb_agg(jsonb_build_object('nome',a."predictorName",'score',a.score,'total',a.total,'em',a."createdAt") ORDER BY a."createdAt" DESC)
                 FROM "GuestChallengeAttempt" a WHERE a."challengeId"=c.id) AS tentativas
         FROM "GuestChallenge" c
        WHERE c."revokedAt" IS NULL AND (c."ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND c."claimedByUserId"=$2))
        ORDER BY c."createdAt" DESC LIMIT 50`,
      [token ? tokenHash(token) : "", userId],
    );
    const logado = Boolean(userId);
    return {
      logado,
      desafios: r.rows.map((c) => ({
        codigo: c.code,
        criadoEm: c.createdAt,
        relacao: c.relation,
        nome: c.creatorName,
        tentativas: (c.tentativas ?? []).map((t) => (logado ? t : { nome: t.nome, em: t.em })),
      })),
    };
  }

  /**
   * Cancela o convite: o link para de funcionar e ninguém mais consegue prever.
   * Vale para o aparelho que criou ou para a conta que reivindicou o desafio.
   */
  async cancelar(codigo: string, token: string | null, userId: string | null): Promise<void> {
    if (!token && !userId) throw new AuthError("FORBIDDEN", 403);
    const r = await this.pool.query(
      `UPDATE "GuestChallenge" SET "revokedAt"=clock_timestamp()
        WHERE code=$1 AND "revokedAt" IS NULL AND ("ownerTokenHash"=$2 OR ($3::uuid IS NOT NULL AND "claimedByUserId"=$3))`,
      [codigoSchema.parse(codigo), token ? tokenHash(token) : "", userId],
    );
    if (!r.rowCount) throw new AuthError("NOT_FOUND", 404);
  }

  /** Desafios que esta pessoa tentou prever (neste aparelho ou na conta), com o placar dela. */
  async recebidos(token: string | null, userId: string | null) {
    if (!token && !userId) return [];
    const r = await this.pool.query<{ code: string; creatorName: string; relation: Contexto; score: number; total: number; createdAt: Date }>(
      `SELECT c.code,c."creatorName",c.relation,a.score,a.total,a."createdAt"
         FROM "GuestChallengeAttempt" a JOIN "GuestChallenge" c ON c.id=a."challengeId"
        WHERE a."ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND a."claimedByUserId"=$2)
        ORDER BY a."createdAt" DESC LIMIT 50`,
      [token ? tokenHash(token) : "", userId],
    );
    return r.rows.map((x) => ({ codigo: x.code, nome: x.creatorName, relacao: x.relation, acertos: x.score, total: x.total, em: x.createdAt }));
  }

  /**
   * Retrato "como você se vê vs. como te veem". Regras de privacidade:
   * só tentativas feitas depois do aviso do retrato, e cada pergunta só entra
   * com pelo menos MINIMO_RETRATO pessoas. Nenhum nome sai daqui.
   */
  async retrato(token: string | null, userId: string | null) {
    const vazio = { eu: null, eles: null, selo: null, respondentes: 0, faltam: MINIMO_RETRATO, relacoes: [] as unknown[] };
    if (!token && !userId) return vazio;
    const r = await this.pool.query<{ id: string; keys: string[]; answers: string[]; relation: Contexto; predictions: string[] | null; aviso: string | null }>(
      `SELECT c.id, c."questionKeys" AS keys, c.answers, c.relation, a.predictions, a."portraitNoticeVersion" AS aviso
         FROM "GuestChallenge" c LEFT JOIN "GuestChallengeAttempt" a ON a."challengeId"=c.id
        WHERE c."revokedAt" IS NULL AND c."catalogVersion"=$3 AND (c."ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND c."claimedByUserId"=$2))`,
      [token ? tokenHash(token) : "", userId, CATALOGO_VERSAO],
    );
    // Como você se vê: todas as suas respostas somadas (mais perguntas, perfil mais preciso).
    const vistos = new Set<string>(); const minhasChaves: string[] = []; const minhasOpcoes: number[] = [];
    const deles: { relacao: Contexto; n: Notas }[] = [];
    for (const l of r.rows) {
      if (!vistos.has(l.id)) { vistos.add(l.id); l.keys.forEach((k, i) => { minhasChaves.push(k); minhasOpcoes.push(indice(l.answers[i] ?? "")); }); }
      if (l.predictions && l.aviso === AVISO_RETRATO_VERSAO) deles.push({ relacao: l.relation, n: notas(l.keys, l.predictions.map(indice)) });
    }
    if (!minhasChaves.length) return vazio;
    const eu = notas(minhasChaves, minhasOpcoes);
    // Como te veem: só com pelo menos 3 pessoas, e só a média (ninguém é identificado).
    const eles = deles.length >= MINIMO_RETRATO ? media(deles.map((x) => x.n)) : null;
    const relacoes = (["familia", "amigos", "crush"] as Contexto[]).map((rel) => {
      const lista = deles.filter((x) => x.relacao === rel);
      if (lista.length < MINIMO_RETRATO) return { relacao: rel, respondentes: lista.length, selo: null, perfil: null };
      const m = media(lista.map((x) => x.n));
      return { relacao: rel, respondentes: lista.length, selo: selo(eu, m), perfil: perfil(m) };
    });
    return {
      eu: perfil(eu), eles: eles ? perfil(eles) : null, selo: eles ? selo(eu, eles) : null,
      respondentes: deles.length, faltam: Math.max(0, MINIMO_RETRATO - deles.length), relacoes,
    };
  }

  /** Liga à conta tudo o que este aparelho fez antes do cadastro. */
  async reivindicar(token: string, userId: string): Promise<number> {
    const dono = tokenHash(token);
    const a = await this.pool.query(
      `UPDATE "GuestChallenge" SET "claimedByUserId"=$2,"claimedAt"=clock_timestamp() WHERE "ownerTokenHash"=$1 AND "claimedByUserId" IS NULL`, [dono, userId]);
    await this.pool.query(
      `UPDATE "GuestChallengeAttempt" SET "claimedByUserId"=$2 WHERE "ownerTokenHash"=$1 AND "claimedByUserId" IS NULL`, [dono, userId]);
    return a.rowCount ?? 0;
  }
}

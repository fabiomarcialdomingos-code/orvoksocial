import { randomInt, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { randomToken, tokenHash } from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/session";
import { AVISO_HASH, AVISO_VERSAO, CATALOGO_VERSAO, CODIGOS, perguntaPublica } from "./catalogo";
import { BANCO } from "./banco";
import {
  TOTAL_PERGUNTAS, conjuntoValido, escolherAncoras, escolherRestantes, perfilDasAncoras, perguntaPorChave, type Estatistica,
} from "./selecao";

const TOTAL = TOTAL_PERGUNTAS;
const DIAS_VALIDADE = 60;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const nome = z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(24));
const opcoes = z.array(z.enum(CODIGOS)).length(TOTAL);
const chaves = z.array(z.string().max(40)).length(TOTAL).refine(conjuntoValido, "conjunto inválido");
export const criarSchema = z.strictObject({
  nome,
  perguntas: chaves,
  respostas: opcoes,
  consentimento: z.strictObject({ aceito: z.literal(true), versao: z.literal(AVISO_VERSAO), hash: z.literal(AVISO_HASH) }),
});
export const tentativaSchema = z.strictObject({ nome: nome.optional(), previsoes: opcoes });
const chavesAncoras = new Set(BANCO.filter((p) => p.ancora).map((p) => p.chave));
export const selecaoSchema = z.strictObject({
  ancoras: z.array(z.strictObject({ chave: z.string().refine((c) => chavesAncoras.has(c)), opcao: z.number().int().min(0).max(3) }))
    .length(3).refine((l) => new Set(l.map((a) => a.chave)).size === 3),
});
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
  async criar(raw: unknown, tokenAtual: string | null): Promise<{ codigo: string; token: string }> {
    const dados = criarSchema.parse(raw);
    const token = tokenAtual ?? randomToken();
    const dono = tokenHash(token);
    await this.limite("criar:global", 3000, 3600);
    await this.limite(`criar:${dono}`, 20, 86400);
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      const codigo = novoCodigo();
      try {
        await this.pool.query(
          `INSERT INTO "GuestChallenge" (id,code,"creatorName","catalogVersion",answers,"questionKeys","consentNoticeVersion","consentNoticeHash","consentedAt","ownerTokenHash","expiresAt")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$8,clock_timestamp(),$9,clock_timestamp()+($10::int * interval '1 day'))`,
          [randomUUID(), codigo, dados.nome, CATALOGO_VERSAO, JSON.stringify(dados.respostas), JSON.stringify(dados.perguntas), AVISO_VERSAO, AVISO_HASH, dono, DIAS_VALIDADE],
        );
        return { codigo, token };
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
      }
    }
    throw new AuthError("CODE_COLLISION", 503);
  }

  private async ativo(codigo: string) {
    const r = await this.pool.query<{ id: string; creatorName: string; answers: string[]; questionKeys: string[]; ownerTokenHash: string }>(
      `SELECT id,"creatorName",answers,"questionKeys","ownerTokenHash" FROM "GuestChallenge"
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
      proprio: token ? tokenHash(token) === d.ownerTokenHash : false,
      perguntas: d.questionKeys.map((c) => perguntaPublica(perguntaPorChave(c)!, d.creatorName)),
      resultado: jaTentou?.rows[0] ?? null,
    };
  }

  /** Abertura do questionário: três âncoras, uma por eixo. */
  ancoras() {
    return escolherAncoras().map((p) => perguntaPublica(p));
  }

  /** Depois das âncoras: as outras sete, escolhidas pelo perfil e pelo que o uso ensinou. */
  async restantes(raw: unknown) {
    const { ancoras } = selecaoSchema.parse(raw);
    const perfil = perfilDasAncoras(ancoras);
    const lista = escolherRestantes(ancoras.map((a) => a.chave), perfil, await this.estatisticas());
    return lista.map((p) => perguntaPublica(p));
  }

  /** Mesmo conjunto de um desafio existente, para o "desafie de volta". */
  async conjuntoDe(codigo: string) {
    const d = await this.ativo(codigo);
    return d.questionKeys.map((c) => perguntaPublica(perguntaPorChave(c)!));
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
  async tentar(codigo: string, raw: unknown, tokenAtual: string | null) {
    const dados = tentativaSchema.parse(raw);
    const d = await this.ativo(codigo);
    const token = tokenAtual ?? randomToken();
    const dono = tokenHash(token);
    if (dono === d.ownerTokenHash) throw new AuthError("OWN_CHALLENGE", 409);
    await this.limite("tentar:global", 6000, 3600);
    await this.limite(`tentar:${dono}`, 60, 86400);
    const score = dados.previsoes.reduce((n, v, i) => n + (v === d.answers[i] ? 1 : 0), 0);
    const r = await this.pool.query<{ score: number; total: number }>(
      `INSERT INTO "GuestChallengeAttempt" (id,"challengeId","predictorName",predictions,score,total,"ownerTokenHash")
       VALUES ($1,$2,$3,$4::jsonb,$5,$6,$7)
       ON CONFLICT ("challengeId","ownerTokenHash") DO UPDATE SET "challengeId"=EXCLUDED."challengeId"
       RETURNING score,total`,
      [randomUUID(), d.id, dados.nome ?? null, JSON.stringify(dados.previsoes), score, TOTAL, dono],
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
      code: string; createdAt: Date; creatorName: string;
      tentativas: { nome: string | null; score: number; total: number; em: string }[] | null;
    }>(
      `SELECT c.code,c."createdAt",c."creatorName",
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

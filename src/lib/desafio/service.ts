import { randomInt, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { randomToken, tokenHash } from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/session";
import { limitar } from "@/lib/limite";
import { registrarEvento } from "@/lib/medicao";
import { AVISO_HASH, AVISO_IDADE, AVISO_IDADE_HASH, AVISO_IDADE_VERSAO, AVISO_RETRATO_VERSAO, AVISO_VERSAO, CATALOGO_VERSAO, CODIGOS, MINIMO_RETRATO, perguntaPublica } from "./catalogo";
import { type Relacao as Contexto } from "./nucleo";
import { NUCLEO, ORDEM_TRACOS } from "./nucleo";
import { media, notas, perfil, selo, type Notas } from "./perfil";
import {
  conjuntoValido, escolherRetrato, perguntaPorChave, TOTAL_PERGUNTAS, type Estatistica,
} from "./selecao";

const DIAS_VALIDADE = 60;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const nome = z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(24));
const opcoes = z.array(z.enum(CODIGOS)).length(TOTAL_PERGUNTAS);
const relacao = z.enum(["familia", "amigos", "crush"]);
export const criarSchema = z.strictObject({
  nome,
  relacao,
  perguntas: z.array(z.string().max(40)).length(TOTAL_PERGUNTAS),
  respostas: opcoes,
  consentimento: z.strictObject({ aceito: z.literal(true), versao: z.literal(AVISO_VERSAO), hash: z.literal(AVISO_HASH) }),
}).refine((d) => conjuntoValido(d.perguntas, d.relacao), "conjunto inválido");
export const tentativaSchema = z.strictObject({
  nome: nome.optional(),
  previsoes: opcoes,
  avisoRetrato: z.literal(AVISO_RETRATO_VERSAO),
  consentimentoIdade: z.strictObject({ aceito: z.literal(true), versao: z.literal(AVISO_IDADE_VERSAO), hash: z.literal(AVISO_IDADE_HASH) }),
});
const motivoDenuncia = z.string().trim().min(1).max(1000);
export const denunciaSchema = z.strictObject({ motivo: motivoDenuncia });
const chavesNucleo = new Set(NUCLEO.map((p) => p.chave));
export const perfilSchema = z.strictObject({ perguntas: z.array(z.string().max(40)).length(TOTAL_PERGUNTAS), respostas: z.array(z.enum(CODIGOS)).length(TOTAL_PERGUNTAS) })
  .refine((d) => d.perguntas.every((c) => chavesNucleo.has(c)) && conjuntoValido(d.perguntas));
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

  private limite(chave: string, max: number, segundos: number): Promise<void> {
    return limitar(this.pool, "desafio", chave, max, segundos);
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
          `INSERT INTO "GuestChallenge" (id,code,"creatorName","catalogVersion",answers,"questionKeys",relation,kind,"consentNoticeVersion","consentNoticeHash","consentedAt","ownerTokenHash","expiresAt","claimedByUserId","claimedAt")
           VALUES ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$13,$8,$9,clock_timestamp(),$10,clock_timestamp()+($11::int * interval '1 day'),$12::uuid,CASE WHEN $12::uuid IS NULL THEN NULL ELSE clock_timestamp() END)`,
          [randomUUID(), codigo, dados.nome, CATALOGO_VERSAO, JSON.stringify(dados.respostas), JSON.stringify(dados.perguntas), dados.relacao, AVISO_VERSAO, AVISO_HASH, dono, DIAS_VALIDADE, userId, "retrato"],
        );
        await registrarEvento(this.pool, "desafio_criado", codigo, dono);
        return { codigo, token };
      } catch (error) {
        if ((error as { code?: string }).code !== "23505") throw error;
      }
    }
    throw new AuthError("CODE_COLLISION", 503);
  }

  private async ativo(codigo: string) {
    const r = await this.pool.query<{ id: string; creatorName: string; answers: string[]; questionKeys: string[]; relation: Contexto; ownerTokenHash: string; claimedByUserId: string | null }>(
      `SELECT id,"creatorName",answers,"questionKeys",relation,"ownerTokenHash","claimedByUserId" FROM "GuestChallenge"
        WHERE code=$1 AND "revokedAt" IS NULL AND "expiresAt">clock_timestamp()`,
      [codigoSchema.parse(codigo)],
    );
    const linha = r.rows[0];
    if (!linha || !conjuntoValido(linha.questionKeys)) throw new AuthError("NOT_FOUND", 404);
    return linha;
  }

  /** true se quem está vendo já bloqueou a pessoa dona deste desafio. */
  private async bloqueadoPor(token: string | null, userId: string | null, dono: { ownerTokenHash: string; claimedByUserId: string | null }): Promise<boolean> {
    if (!token && !userId) return false;
    const r = await this.pool.query(
      `SELECT 1 FROM "GuestBlock"
        WHERE "blockerTokenHash"=$1 AND (("blockedOwnerTokenHash" IS NOT NULL AND "blockedOwnerTokenHash"=$2)
          OR ($3::uuid IS NOT NULL AND "blockedOwnerUserId"=$3)) LIMIT 1`,
      [token ? tokenHash(token) : "", dono.ownerTokenHash, dono.claimedByUserId],
    );
    return (r.rowCount ?? 0) > 0;
  }

  /** O que quem recebeu o convite pode ver: nome e perguntas. Nunca as respostas. */
  /**
   * O que qualquer pessoa (ou robô de prévia) pode ver do convite: só o nome e a relação. Não registra "convite aberto":
   * antes, cada leitura do título e cada desenho da imagem contavam como um convite aberto de verdade.
   */
  async resumoPublico(codigo: string): Promise<{ id: string; nome: string; relacao: Contexto }> {
    const d = await this.ativo(codigo);
    return { id: d.id, nome: d.creatorName, relacao: d.relation };
  }

  async vitrine(codigo: string, token: string | null, userId: string | null = null) {
    const d = await this.ativo(codigo);
    if (await this.bloqueadoPor(token, userId, d)) throw new AuthError("BLOCKED", 403);
    await registrarEvento(this.pool, "convite_aberto", codigo, token ? tokenHash(token) : null);
    const jaRespondeu = token
      ? ((await this.pool.query(`SELECT 1 FROM "GuestChallengeAttempt" WHERE "challengeId"=$1 AND "ownerTokenHash"=$2`, [d.id, tokenHash(token)])).rowCount ?? 0) > 0
      : false;
    return {
      nome: d.creatorName,
      relacao: d.relation,
      proprio: token ? tokenHash(token) === d.ownerTokenHash : false,
      perguntas: d.questionKeys.map((c) => perguntaPublica(perguntaPorChave(c)!, d.creatorName)),
      jaRespondeu,
      avisoIdade: AVISO_IDADE,
    };
  }

  /** As 12 perguntas do retrato para esta relação. */
  async conjunto(rel: Contexto) {
    return escolherRetrato(rel, await this.estatisticas()).map((p) => perguntaPublica(p));
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

  /** Registra a opinião de quem recebeu o convite. Uma por aparelho; nenhuma pontuação, nenhum certo ou errado. */
  async tentar(codigo: string, raw: unknown, tokenAtual: string | null, userId: string | null = null) {
    const dados = tentativaSchema.parse(raw);
    const d = await this.ativo(codigo);
    const token = tokenAtual ?? randomToken();
    const dono = tokenHash(token);
    if (dono === d.ownerTokenHash) throw new AuthError("OWN_CHALLENGE", 409);
    if (await this.bloqueadoPor(token, userId, d)) throw new AuthError("BLOCKED", 403);
    await this.limite("tentar:global", 6000, 3600);
    await this.limite(`tentar:${dono}`, 60, 86400);
    if (dados.previsoes.length !== d.questionKeys.length) throw new AuthError("INVALID_INPUT", 400);
    // Devolvido a quem responde (antes de gravar, para contar só as outras pessoas).
    const miniResultado = await this.alinhamentoComOutros(d.id, dono, d.questionKeys, dados.previsoes);
    // As colunas de pontuação ficam no banco por compatibilidade, mas não existe mais pontuação.
    await this.pool.query(
      `INSERT INTO "GuestChallengeAttempt" (id,"challengeId","predictorName",predictions,score,total,"ownerTokenHash","claimedByUserId","portraitNoticeVersion","ageConsentVersion")
       VALUES ($1,$2,$3,$4::jsonb,0,$5,$6,$7::uuid,$8,$9)
       ON CONFLICT ("challengeId","ownerTokenHash") DO UPDATE SET "challengeId"=EXCLUDED."challengeId"`,
      [randomUUID(), d.id, dados.nome ?? null, JSON.stringify(dados.previsoes), d.questionKeys.length, dono, userId, dados.avisoRetrato, dados.consentimentoIdade.versao],
    );
    await registrarEvento(this.pool, "tentativa_concluida", codigo, dono);
    await this.registrarEvolucao(d.ownerTokenHash, d.claimedByUserId);
    return { token, miniResultado };
  }

  /** Retrato: em quantos dos 6 traços esta opinião bate com a maioria de quem já opinou. */
  private async alinhamentoComOutros(challengeId: string, dono: string, chaves: string[], previsoes: string[]): Promise<{ poucosDados: true } | { poucosDados: false; bateram: number; deTotal: number }> {
    const r = await this.pool.query<{ predictions: string[] }>(
      `SELECT predictions FROM "GuestChallengeAttempt" WHERE "challengeId"=$1 AND "ownerTokenHash"<>$2 AND "portraitNoticeVersion"=$3 AND predictions IS NOT NULL`,
      [challengeId, dono, AVISO_RETRATO_VERSAO]);
    if (r.rows.length < 2) return { poucosDados: true };
    const outros = media(r.rows.map((x) => notas(chaves, x.predictions.map(indice))));
    const minha = notas(chaves, previsoes.map(indice));
    const comparaveis = ORDEM_TRACOS.filter((t) => minha[t] !== null && outros[t] !== null);
    const bateram = comparaveis.filter((t) => (minha[t]! >= 0) === (outros[t]! >= 0)).length;
    return { poucosDados: false, bateram, deTotal: comparaveis.length };
  }

  /**
   * Denúncia de um convite: fica guardada para revisão manual. O e-mail para
   * contato@orvok.com.br é enviado pela rota da API, não por aqui.
   */
  async denunciar(codigo: string, raw: unknown, tokenAtual: string | null, userId: string | null): Promise<{ id: string; nome: string; motivo: string; token: string }> {
    const { motivo } = denunciaSchema.parse(raw);
    const d = await this.ativo(codigo);
    const token = tokenAtual ?? randomToken();
    await this.limite(`denunciar:${tokenHash(token)}`, 10, 86400);
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO "GuestReport" (id,"challengeId","reporterTokenHash","reporterUserId",reason) VALUES ($1,$2,$3,$4::uuid,$5)`,
      [id, d.id, tokenHash(token), userId, motivo],
    );
    return { id, nome: d.creatorName, motivo, token };
  }

  /**
   * Bloqueia quem enviou este convite: essa pessoa deixa de conseguir te
   * enviar novos convites. Não afeta quem mais recebeu o mesmo link.
   */
  async bloquear(codigo: string, tokenAtual: string | null, userId: string | null): Promise<{ token: string }> {
    const d = await this.ativo(codigo);
    const token = tokenAtual ?? randomToken();
    if (tokenHash(token) === d.ownerTokenHash) throw new AuthError("OWN_CHALLENGE", 409);
    await this.pool.query(
      `INSERT INTO "GuestBlock" (id,"blockerTokenHash","blockerUserId","blockedOwnerTokenHash","blockedOwnerUserId")
       VALUES ($1,$2,$3::uuid,$4,$5::uuid)
       ON CONFLICT DO NOTHING`,
      [randomUUID(), tokenHash(token), userId, d.ownerTokenHash, d.claimedByUserId],
    );
    return { token };
  }

  /**
   * Convites deste aparelho (e da conta, se houver). As respostas são sempre
   * anônimas: só a data e quantas pessoas responderam.
   */
  async meus(token: string | null, userId: string | null) {
    if (!token && !userId) return { desafios: [], logado: false };
    const r = await this.pool.query<{
      code: string; createdAt: Date; creatorName: string; relation: Contexto;
      tentativas: { em: string }[] | null;
    }>(
      `SELECT c.code,c."createdAt",c."creatorName",c.relation,
              (SELECT jsonb_agg(jsonb_build_object('em',a."createdAt") ORDER BY a."createdAt" DESC)
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
        tentativas: (c.tentativas ?? []).map((t) => ({ em: t.em })),
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

  /** Pessoas sobre quem esta pessoa deu a sua visão (neste aparelho ou na conta). */
  async recebidos(token: string | null, userId: string | null) {
    if (!token && !userId) return [];
    const r = await this.pool.query<{ code: string; creatorName: string; relation: Contexto; createdAt: Date }>(
      `SELECT c.code,c."creatorName",c.relation,a."createdAt"
         FROM "GuestChallengeAttempt" a JOIN "GuestChallenge" c ON c.id=a."challengeId"
        WHERE a."ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND a."claimedByUserId"=$2)
        ORDER BY a."createdAt" DESC LIMIT 50`,
      [token ? tokenHash(token) : "", userId],
    );
    return r.rows.map((x) => ({ codigo: x.code, nome: x.creatorName, relacao: x.relation, em: x.createdAt }));
  }

  /**
   * Retrato "como você se vê vs. como te veem". Regras de privacidade:
   * só tentativas feitas depois do aviso do retrato, e cada pergunta só entra
   * com pelo menos MINIMO_RETRATO pessoas. Nenhum nome sai daqui.
   */
  async retrato(token: string | null, userId: string | null) {
    if (!token && !userId) return this.retratoVazio();
    return this.retratoPorHash(token ? tokenHash(token) : "", userId);
  }

  private retratoVazio() {
    return { eu: null, eles: null, selo: null, respondentes: 0, faltam: MINIMO_RETRATO, relacoes: [] as unknown[], ocultos: [] as string[], apareceram: [] as string[] };
  }

  /** Núcleo do retrato, a partir do hash do dono (não de um token bruto) — usado também para tirar o marco de evolução depois de uma nova opinião. */
  private async retratoPorHash(donoHash: string, userId: string | null) {
    const vazio = this.retratoVazio();
    const r = await this.pool.query<{ id: string; keys: string[]; answers: string[]; relation: Contexto; predictions: string[] | null; aviso: string | null }>(
      `SELECT c.id, c."questionKeys" AS keys, c.answers, c.relation, a.predictions, a."portraitNoticeVersion" AS aviso
         FROM "GuestChallenge" c LEFT JOIN "GuestChallengeAttempt" a ON a."challengeId"=c.id
        WHERE c."revokedAt" IS NULL AND c."catalogVersion"=$3 AND (c."ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND c."claimedByUserId"=$2))`,
      [donoHash, userId, CATALOGO_VERSAO],
    );
    // Como você se vê: todas as suas respostas somadas (mais perguntas, perfil mais preciso).
    const vistos = new Set<string>(); const minhasChaves: string[] = []; const minhasOpcoes: number[] = [];
    const deles: { relacao: Contexto; n: Notas }[] = [];
    for (const l of r.rows) {
      if (!vistos.has(l.id)) { vistos.add(l.id); l.keys.forEach((k, i) => { minhasChaves.push(k); minhasOpcoes.push(indice(l.answers[i] ?? "")); }); }
      // Como te veem: só opiniões dadas depois do aviso de anonimato do retrato.
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
    // Oculto: traços que a própria pessoa marcou como "eu sei, mas não mostro".
    // Nunca aparece pra mais ninguém; nunca entra na comparação nem no selo.
    const oc = await this.pool.query<{ traco: string }>(
      `SELECT traco FROM "HiddenTrait" WHERE "ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND "claimedByUserId"=$2)`,
      [donoHash, userId]);
    const ocultos = oc.rows.map((x) => x.traco as (typeof ORDEM_TRACOS)[number]).filter((t) => ORDEM_TRACOS.includes(t));
    // Quando um traço guardado passa a bater com a média de quem respondeu, é sinal de que começou a aparecer sozinho.
    const apareceram = eles ? ocultos.filter((t) => ((eu[t] ?? 0) >= 0) === ((eles[t] ?? 0) >= 0)) : [];
    return {
      eu: perfil(eu), eles: eles ? perfil(eles) : null, selo: eles ? selo(eu, eles) : null,
      respondentes: deles.length, faltam: Math.max(0, MINIMO_RETRATO - deles.length), relacoes, ocultos, apareceram,
    };
  }

  /**
   * Depois de uma nova opinião no retrato de alguém, confere se o selo dessa
   * pessoa mudou desde o último marco e, se mudou, grava um novo. Não grava
   * a cada opinião — só quando o selo realmente muda — para a linha do
   * tempo mostrar evolução de verdade, não ruído.
   */
  private async registrarEvolucao(donoHash: string, claimedByUserId: string | null): Promise<void> {
    const d = await this.retratoPorHash(donoHash, claimedByUserId);
    if (!d.eles || !d.selo) return;
    const ultimo = await this.pool.query<{ nivel: string | null }>(
      `SELECT nivel FROM "RetratoSnapshot" WHERE "ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND "claimedByUserId"=$2)
        ORDER BY "createdAt" DESC LIMIT 1`,
      [donoHash, claimedByUserId]);
    if (ultimo.rows[0] && ultimo.rows[0].nivel === d.selo.nivel) return;
    await this.pool.query(
      `INSERT INTO "RetratoSnapshot" (id,"ownerTokenHash","claimedByUserId",respondentes,batem,nivel) VALUES ($1,$2,$3::uuid,$4,$5,$6)`,
      [randomUUID(), donoHash, claimedByUserId, d.respondentes, d.selo.batem, d.selo.nivel]);
  }

  /** A evolução do selo ao longo do tempo (só os marcos em que ele mudou). */
  async linhaDoTempo(token: string | null, userId: string | null): Promise<{ em: Date; respondentes: number; batem: number; nivel: string | null }[]> {
    if (!token && !userId) return [];
    const r = await this.pool.query<{ em: Date; respondentes: number; batem: number; nivel: string | null }>(
      `SELECT "createdAt" AS em, respondentes, batem, nivel FROM "RetratoSnapshot"
        WHERE "ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND "claimedByUserId"=$2) ORDER BY "createdAt" ASC`,
      [token ? tokenHash(token) : "", userId]);
    return r.rows;
  }

  /** Marca ou desmarca, só para a própria pessoa, um traço que ela sabe de si e escolhe não mostrar. */
  async marcarOculto(raw: unknown, token: string | null, userId: string | null): Promise<{ ocultos: string[] }> {
    if (!token && !userId) throw new AuthError("FORBIDDEN", 403);
    const { traco, oculto } = z.strictObject({ traco: z.enum(ORDEM_TRACOS as [string, ...string[]]), oculto: z.boolean() }).parse(raw);
    const dono = token ? tokenHash(token) : null;
    if (oculto) {
      await this.pool.query(
        `INSERT INTO "HiddenTrait" (id,"ownerTokenHash","claimedByUserId",traco) VALUES ($1,$2,$3::uuid,$4) ON CONFLICT DO NOTHING`,
        [randomUUID(), dono, userId, traco]);
    } else {
      await this.pool.query(`DELETE FROM "HiddenTrait" WHERE (("ownerTokenHash"=$1 AND $1 IS NOT NULL) OR ($2::uuid IS NOT NULL AND "claimedByUserId"=$2)) AND traco=$3`, [dono, userId, traco]);
    }
    const r = await this.pool.query<{ traco: string }>(
      `SELECT traco FROM "HiddenTrait" WHERE "ownerTokenHash"=$1 OR ($2::uuid IS NOT NULL AND "claimedByUserId"=$2)`, [dono ?? "", userId]);
    return { ocultos: r.rows.map((x) => x.traco) };
  }

  /** Liga à conta tudo o que este aparelho fez antes do cadastro. */
  async reivindicar(token: string, userId: string): Promise<number> {
    const dono = tokenHash(token);
    const a = await this.pool.query(
      `UPDATE "GuestChallenge" SET "claimedByUserId"=$2,"claimedAt"=clock_timestamp() WHERE "ownerTokenHash"=$1 AND "claimedByUserId" IS NULL`, [dono, userId]);
    await this.pool.query(
      `UPDATE "GuestChallengeAttempt" SET "claimedByUserId"=$2 WHERE "ownerTokenHash"=$1 AND "claimedByUserId" IS NULL`, [dono, userId]);
    await this.pool.query(
      `UPDATE "HiddenTrait" SET "claimedByUserId"=$2 WHERE "ownerTokenHash"=$1 AND "claimedByUserId" IS NULL
         AND NOT EXISTS (SELECT 1 FROM "HiddenTrait" h2 WHERE h2."claimedByUserId"=$2 AND h2.traco="HiddenTrait".traco)`, [dono, userId]);
    await this.pool.query(
      `UPDATE "RetratoSnapshot" SET "claimedByUserId"=$2 WHERE "ownerTokenHash"=$1 AND "claimedByUserId" IS NULL`, [dono, userId]);
    return a.rowCount ?? 0;
  }
}

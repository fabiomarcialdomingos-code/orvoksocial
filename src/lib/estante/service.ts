import { createHash, randomInt, randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";
import { z } from "zod";
import { tokenHash } from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/session";
import { AVISO_IDADE_HASH, AVISO_IDADE_VERSAO } from "@/lib/desafio/catalogo";
import { avisar } from "@/lib/avisar";
import { limitar } from "@/lib/limite";
import { enviarDenunciaDaEstantePorEmail } from "@/lib/desafio/moderacao-mail";
import { registrarEvento } from "@/lib/medicao";
import { processarImagem, type Finalidade } from "./imagem";
import { ilustradorAnthropic, type Ilustrador } from "./ilustrador";
import { moderadorAnthropic, type Moderador } from "./moderacao";
import { normalizarObjeto } from "./svg";

/**
 * A Estante. Alguém lembra de você, guarda isso como um objeto na sua estante e diz o quanto
 * acha que você vai gostar. Você reage, e quem mandou descobre a diferença (quase sempre
 * subestimamos o quanto o outro aprecia o gesto: essa é a recompensa de quem manda).
 *
 * Privacidade:
 *  - A frase de uma lembrança é só de quem mandou e de quem recebeu. Quem visita a estante vê o
 *    objeto e quem deu, nunca a frase.
 *  - A estante só é vista por quem é do círculo (vínculo ativo). Bloquear encerra isso.
 *  - Visitas passivas viram só uma contagem; o nome só aparece se a pessoa escolher deixar o
 *    "passei por aqui".
 */
export type Ator = { token: string | null; userId: string | null };

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codigo = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");

const nomeSchema = z.string().trim().min(1).max(24).regex(/^[\p{L}\p{N} .'-]+$/u);
const idadeSchema = z.strictObject({ aceito: z.literal(true), versao: z.literal(AVISO_IDADE_VERSAO), hash: z.literal(AVISO_IDADE_HASH) });
const nota15 = z.number().int().min(1).max(5);

type Pessoa = { id: string; userId: string | null; nome: string; inviteCode: string; idadeOk: boolean; avatar: string | null };
type LinhaPessoa = { id: string; userId: string | null; name: string; inviteCode: string; ageConsentVersion: string | null; avatarImageId: string | null };
const dePessoa = (r: LinhaPessoa): Pessoa => ({ id: r.id, userId: r.userId, nome: r.name, inviteCode: r.inviteCode, idadeOk: r.ageConsentVersion === AVISO_IDADE_VERSAO, avatar: r.avatarImageId });

export class EstanteService {
  constructor(private readonly pool: Pool, private readonly moderador: Moderador = moderadorAnthropic(), private readonly ilustrador: Ilustrador = ilustradorAnthropic()) {}

  /** O interruptor de lançamento. Tudo da Estante fica escondido enquanto estiver desligado, ou sem moderação configurada. */
  async ativa(): Promise<boolean> {
    const r = await this.pool.query<{ enabled: boolean }>(`SELECT enabled FROM "AppFlag" WHERE name='estante'`).catch(() => null);
    return r?.rows[0]?.enabled === true && this.moderador.configurado();
  }
  /** Fotos só funcionam com a moderação configurada. */
  fotosDisponiveis(): boolean { return this.moderador.configurado(); }

  // ---------- moderação ----------

  /** Quem foi recusado várias vezes no dia espera até o dia seguinte. */
  private async barrarInsistentes(pessoaId: string): Promise<void> {
    const r = await this.pool.query<{ n: string }>(
      `SELECT count(*) AS n FROM "ShelfModerationLog" WHERE "personId"=$1 AND NOT ok AND reason NOT IN ('indisponivel','sem_moderacao') AND "createdAt" > clock_timestamp() - interval '24 hours'`, [pessoaId]);
    if (Number(r.rows[0]!.n) >= 5) throw new AuthError("RATE_LIMITED", 429);
  }
  private async registrarVeredito(pessoaId: string, tipo: "imagem" | "texto", v: { ok: boolean; motivo: string }, sha: string | null): Promise<void> {
    await this.pool.query(`INSERT INTO "ShelfModerationLog"("personId",kind,ok,reason,sha256) VALUES ($1,$2,$3,$4,$5)`, [pessoaId, tipo, v.ok, v.motivo.slice(0, 40), sha]);
    if (v.ok) return;
    const fora = v.motivo === "indisponivel" || v.motivo === "sem_moderacao";
    throw new AuthError(fora ? "SERVICE_UNAVAILABLE" : "CONTENT_REJECTED", fora ? 503 : 422);
  }
  private async moderarTexto(pessoaId: string, texto: string): Promise<void> {
    if (!this.moderador.configurado()) throw new AuthError("SERVICE_UNAVAILABLE", 503);
    await this.barrarInsistentes(pessoaId);
    await this.registrarVeredito(pessoaId, "texto", await this.moderador.texto(texto), null);
  }
  async ligar(ligada: boolean): Promise<void> {
    await this.pool.query(`INSERT INTO "AppFlag"(name,enabled) VALUES ('estante',$1) ON CONFLICT (name) DO UPDATE SET enabled=$1,"updatedAt"=clock_timestamp()`, [ligada]);
  }

  // ---------- quem é quem ----------

  /** Acha a pessoa deste ator (conta ou aparelho). Se a conta ainda não tem pessoa e o aparelho tem, junta as duas. */
  async achar(ator: Ator): Promise<Pessoa | null> {
    const hash = ator.token ? tokenHash(ator.token) : null;
    const porConta = ator.userId ? (await this.pool.query<LinhaPessoa>(`SELECT id,"userId",name,"inviteCode","ageConsentVersion","avatarImageId" FROM "ShelfPerson" WHERE "userId"=$1`, [ator.userId])).rows[0] : undefined;
    const porAparelho = hash ? (await this.pool.query<LinhaPessoa>(`SELECT id,"userId",name,"inviteCode","ageConsentVersion","avatarImageId" FROM "ShelfPerson" WHERE "tokenHash"=$1`, [hash])).rows[0] : undefined;
    if (porConta && porAparelho && porConta.id !== porAparelho.id) { await this.juntar(porConta.id, porAparelho.id); return this.carregar(porConta.id); }
    if (porConta) return dePessoa(porConta);
    if (porAparelho) {
      if (ator.userId && porAparelho.userId === null) {
        await this.pool.query(`UPDATE "ShelfPerson" SET "userId"=$2 WHERE id=$1 AND "userId" IS NULL`, [porAparelho.id, ator.userId]);
        return this.carregar(porAparelho.id);
      }
      return dePessoa(porAparelho);
    }
    return null;
  }

  private async carregar(id: string): Promise<Pessoa> {
    const r = await this.pool.query<LinhaPessoa>(`SELECT id,"userId",name,"inviteCode","ageConsentVersion","avatarImageId" FROM "ShelfPerson" WHERE id=$1`, [id]);
    return dePessoa(r.rows[0]!);
  }

  /** Quem entrou como convidado e depois criou conta: tudo que era do aparelho passa para a conta. */
  private async juntar(destino: string, origem: string): Promise<void> {
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(`UPDATE "Keepsake" SET "fromId"=$1 WHERE "fromId"=$2`, [destino, origem]);
      await c.query(`UPDATE "Keepsake" SET "toId"=$1 WHERE "toId"=$2`, [destino, origem]);
      await c.query(`UPDATE "ShelfVisit" SET "visitorId"=$1 WHERE "visitorId"=$2 AND NOT EXISTS (SELECT 1 FROM "ShelfVisit" v WHERE v."ownerId"="ShelfVisit"."ownerId" AND v."visitorId"=$1 AND v.day="ShelfVisit".day)`, [destino, origem]);
      await c.query(`UPDATE "ShelfVisit" SET "ownerId"=$1 WHERE "ownerId"=$2 AND NOT EXISTS (SELECT 1 FROM "ShelfVisit" v WHERE v."ownerId"=$1 AND v."visitorId"="ShelfVisit"."visitorId" AND v.day="ShelfVisit".day)`, [destino, origem]);
      const laços = await c.query<{ id: string; a: string; b: string; status: string; blockedBy: string | null }>(`SELECT id,"personA" AS a,"personB" AS b,status,"blockedBy" FROM "ShelfBond" WHERE "personA"=$1 OR "personB"=$1`, [origem]);
      for (const l of laços.rows) {
        const outro = l.a === origem ? l.b : l.a;
        await c.query(`DELETE FROM "ShelfBond" WHERE id=$1`, [l.id]);
        if (outro !== destino) await this.criarVinculo(c, destino, outro, l.status === "BLOCKED" ? { por: l.blockedBy === origem ? destino : l.blockedBy } : undefined);
      }
      await c.query(`DELETE FROM "ShelfPerson" WHERE id=$1`, [origem]);
      await c.query("COMMIT");
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  }

  /** Cria (ou confirma) a pessoa deste ator. Exige nome e a confirmação de 16+ e Termos na primeira vez. */
  async garantir(ator: Ator, dados: { nome?: unknown; consentimentoIdade?: unknown } = {}): Promise<Pessoa> {
    const existente = await this.achar(ator);
    if (existente) {
      if (!existente.idadeOk && dados.consentimentoIdade !== undefined) {
        idadeSchema.parse(dados.consentimentoIdade);
        await this.pool.query(`UPDATE "ShelfPerson" SET "ageConsentVersion"=$2 WHERE id=$1`, [existente.id, AVISO_IDADE_VERSAO]);
        return { ...existente, idadeOk: true };
      }
      return existente;
    }
    if (!ator.userId && !ator.token) throw new AuthError("UNAUTHENTICATED", 401);
    const nome = nomeSchema.parse(dados.nome);
    idadeSchema.parse(dados.consentimentoIdade);
    const id = randomUUID();
    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        await this.pool.query(`INSERT INTO "ShelfPerson"(id,"userId","tokenHash",name,"inviteCode","ageConsentVersion") VALUES ($1,$2,$3,$4,$5,$6)`,
          [id, ator.userId, ator.token ? tokenHash(ator.token) : null, nome, codigo(), AVISO_IDADE_VERSAO]);
        return await this.carregar(id);
      } catch (e) { if ((e as { code?: string }).code !== "23505") throw e; const de = await this.achar(ator); if (de) return de; }
    }
    throw new AuthError("INTERNAL_ERROR", 500);
  }

  // ---------- círculo ----------

  private async criarVinculo(c: Pool | PoolClient, x: string, y: string, bloqueio?: { por: string | null }): Promise<boolean> {
    const [a, b] = x < y ? [x, y] : [y, x];
    const r = await c.query(`INSERT INTO "ShelfBond"(id,"personA","personB",status,"blockedBy") VALUES ($1,$2,$3,$4,$5) ON CONFLICT ("personA","personB") DO NOTHING`,
      [randomUUID(), a, b, bloqueio ? "BLOCKED" : "ACTIVE", bloqueio?.por ?? null]);
    return (r.rowCount ?? 0) > 0;
  }

  private async vinculo(x: string, y: string): Promise<{ status: string } | null> {
    const [a, b] = x < y ? [x, y] : [y, x];
    return (await this.pool.query<{ status: string }>(`SELECT status FROM "ShelfBond" WHERE "personA"=$1 AND "personB"=$2`, [a, b])).rows[0] ?? null;
  }
  private async exigirVinculoAtivo(x: string, y: string): Promise<void> {
    const v = await this.vinculo(x, y);
    if (!v || v.status !== "ACTIVE") throw new AuthError("FORBIDDEN", 403);
  }

  /** Quem usa o link de convite de alguém entra no círculo dessa pessoa (e ela no dele). */
  async entrarPeloConvite(codigoConvite: string, ator: Ator, dados: { nome?: unknown; consentimentoIdade?: unknown }) {
    const dono = (await this.pool.query<LinhaPessoa>(`SELECT id,"userId",name,"inviteCode","ageConsentVersion","avatarImageId" FROM "ShelfPerson" WHERE "inviteCode"=$1`, [codigoConvite.toUpperCase()])).rows[0];
    if (!dono) throw new AuthError("NOT_FOUND", 404);
    const eu = await this.garantir(ator, dados);
    if (!eu.idadeOk) throw new AuthError("AGE_REQUIRED", 403);
    if (eu.id === dono.id) throw new AuthError("CONFLICT", 409);
    const atual = await this.vinculo(eu.id, dono.id);
    if (atual?.status === "BLOCKED") throw new AuthError("FORBIDDEN", 403);
    if (!atual && await this.criarVinculo(this.pool, eu.id, dono.id)) void registrarEvento(this.pool, "estante_vinculo", null, eu.id);
    return { pessoa: { id: dono.id, nome: dono.name } };
  }

  /** O que se vê no link de convite, antes de aceitar: só o nome de quem convida. */
  async previaConvite(codigoConvite: string): Promise<{ nome: string }> {
    const r = await this.pool.query<{ name: string }>(`SELECT name FROM "ShelfPerson" WHERE "inviteCode"=$1`, [codigoConvite.toUpperCase()]);
    if (!r.rows[0]) throw new AuthError("NOT_FOUND", 404);
    return { nome: r.rows[0].name };
  }

  async circulo(ator: Ator) {
    const eu = await this.achar(ator);
    if (!eu) return { convite: null, avatar: null as string | null, pessoas: [] as { id: string; nome: string; avatar: string | null }[] };
    const r = await this.pool.query<{ id: string; name: string; avatar: string | null }>(
      `SELECT p.id,p.name,p."avatarImageId" AS avatar FROM "ShelfBond" b JOIN "ShelfPerson" p ON p.id = CASE WHEN b."personA"=$1 THEN b."personB" ELSE b."personA" END
        WHERE (b."personA"=$1 OR b."personB"=$1) AND b.status='ACTIVE' ORDER BY p.name`, [eu.id]);
    return { convite: eu.inviteCode, avatar: eu.avatar, pessoas: r.rows.map((x) => ({ id: x.id, nome: x.name, avatar: x.avatar })) };
  }

  async bloquear(ator: Ator, pessoaId: string): Promise<void> {
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    z.uuid().parse(pessoaId);
    if (pessoaId === eu.id) throw new AuthError("CONFLICT", 409);
    if (!((await this.pool.query(`SELECT 1 FROM "ShelfPerson" WHERE id=$1`, [pessoaId])).rowCount)) throw new AuthError("NOT_FOUND", 404);
    const [a, b] = eu.id < pessoaId ? [eu.id, pessoaId] : [pessoaId, eu.id];
    const c = await this.pool.connect();
    try {
      await c.query("BEGIN");
      await c.query(`INSERT INTO "ShelfBond"(id,"personA","personB",status,"blockedBy") VALUES ($1,$2,$3,'BLOCKED',$4) ON CONFLICT ("personA","personB") DO UPDATE SET status='BLOCKED',"blockedBy"=$4`, [randomUUID(), a, b, eu.id]);
      // O que a pessoa bloqueada deu a quem bloqueou sai da estante de quem bloqueou.
      await c.query(`UPDATE "Keepsake" SET state='HIDDEN' WHERE "fromId"=$1 AND "toId"=$2 AND state='VISIBLE'`, [pessoaId, eu.id]);
      await c.query("COMMIT");
    } catch (e) { await c.query("ROLLBACK"); throw e; } finally { c.release(); }
  }

  // ---------- lembranças ----------

  /**
   * Manda uma lembrança. Para alguém do círculo ("paraPessoaId") ela já entra na estante da pessoa.
   * Para alguém de fora ("paraNome") vira um presente com link, que a pessoa abre sem cadastro.
   */
  async enviar(ator: Ator, raw: unknown) {
    const d = z.strictObject({
      paraPessoaId: z.uuid().optional(), paraNome: nomeSchema.optional(),
      titulo: z.string().trim().min(1).max(60), frase: z.string().trim().max(240).optional(), imageId: z.uuid().optional(),
      previsao: nota15, nome: nomeSchema.optional(), consentimentoIdade: idadeSchema.optional(),
    }).refine((x) => (x.paraPessoaId === undefined) !== (x.paraNome === undefined)).parse(raw);
    const eu = await this.garantir(ator, { nome: d.nome, consentimentoIdade: d.consentimentoIdade });
    if (!eu.idadeOk) throw new AuthError("AGE_REQUIRED", 403);
    await limitar(this.pool, "estante", `enviar:${eu.id}`, 20, 86400);
    if (d.paraPessoaId) {
      if (d.paraPessoaId === eu.id) throw new AuthError("CONFLICT", 409);
      await this.exigirVinculoAtivo(eu.id, d.paraPessoaId);
    }
    if (d.imageId) {
      const livre = await this.pool.query(`SELECT 1 FROM "ShelfImage" i WHERE i.id=$1 AND i."ownerId"=$2 AND i.purpose='keepsake' AND NOT EXISTS (SELECT 1 FROM "Keepsake" k WHERE k."imageId"=i.id)`, [d.imageId, eu.id]);
      if (!livre.rowCount) throw new AuthError("NOT_FOUND", 404);
    }
    await this.moderarTexto(eu.id, `${d.titulo}\n${d.frase ?? ""}`);
    // O limite por pessoa só conta o que de fato foi enviado: uma recusa da moderação não gasta a cota.
    if (d.paraPessoaId) await limitar(this.pool, "estante", `enviar:${eu.id}:${d.paraPessoaId}`, 4, 86400);
    const id = randomUUID(), cod = codigo();
    await this.pool.query(
      `INSERT INTO "Keepsake"(id,code,"fromId","toId","toName",title,note,"imageId",predicted) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, cod, eu.id, d.paraPessoaId ?? null, d.paraNome ?? null, d.titulo, d.frase || null, d.imageId ?? null, d.previsao]);
    void registrarEvento(this.pool, "estante_lembranca_enviada", cod, eu.id);
    if (d.paraPessoaId) {
      const dest = await this.carregar(d.paraPessoaId);
      if (dest.userId) await avisar(this.pool, dest.userId, "ESTANTE_LEMBRANCA", id, { titulo: "Lembraram de você", corpo: `${eu.nome} guardou algo na sua estante.`, url: "/estante" });
    }
    return { id, codigo: cod, tipo: d.paraPessoaId ? ("direta" as const) : ("presente" as const) };
  }

  /** O que qualquer pessoa vê no link de um presente, antes de abrir: o objeto e quem deu. Nunca a frase. */
  async verPresente(cod: string) {
    const k = (await this.pool.query<{ title: string; svg: string | null; de: string; toId: string | null }>(
      `SELECT k.title,k."illustrationSvg" AS svg,p.name AS de,k."toId" FROM "Keepsake" k JOIN "ShelfPerson" p ON p.id=k."fromId" WHERE k.code=$1 AND k.state IN ('VISIBLE','PENDING')`, [cod.toUpperCase()])).rows[0];
    if (!k) throw new AuthError("NOT_FOUND", 404);
    return { objeto: k.title, ilustracao: k.svg, de: k.de, jaAberto: k.toId !== null };
  }

  /** Quem abre o link primeiro fica com o presente: ele entra na estante e quem deu entra no círculo. */
  async abrirPresente(cod: string, ator: Ator, dados: { nome?: unknown; consentimentoIdade?: unknown }) {
    const k = (await this.pool.query<{ id: string; fromId: string; toId: string | null; title: string; note: string | null; svg: string | null; imageId: string | null }>(
      `SELECT id,"fromId","toId",title,note,"illustrationSvg" AS svg,"imageId" FROM "Keepsake" WHERE code=$1 AND state IN ('VISIBLE','PENDING')`, [cod.toUpperCase()])).rows[0];
    if (!k) throw new AuthError("NOT_FOUND", 404);
    const eu = await this.garantir(ator, dados);
    if (!eu.idadeOk) throw new AuthError("AGE_REQUIRED", 403);
    if (eu.id === k.fromId) throw new AuthError("CONFLICT", 409);
    const vinc = await this.vinculo(eu.id, k.fromId);
    if (vinc?.status === "BLOCKED") throw new AuthError("FORBIDDEN", 403);
    if (k.toId !== null && k.toId !== eu.id) throw new AuthError("CONFLICT", 409);
    if (k.toId === null) {
      const r = await this.pool.query(`UPDATE "Keepsake" SET "toId"=$2,"openedAt"=clock_timestamp() WHERE id=$1 AND "toId" IS NULL`, [k.id, eu.id]);
      if ((r.rowCount ?? 0) === 0) throw new AuthError("CONFLICT", 409);
      void registrarEvento(this.pool, "estante_presente_aberto", cod.toUpperCase(), eu.id);
      if (!vinc && await this.criarVinculo(this.pool, eu.id, k.fromId)) void registrarEvento(this.pool, "estante_vinculo", null, eu.id);
      const quem = await this.carregar(k.fromId);
      if (quem.userId) await avisar(this.pool, quem.userId, "ESTANTE_PRESENTE_ABERTO", k.id, { titulo: "Seu presente foi aberto", corpo: `${eu.nome} guardou a sua lembrança.`, url: "/estante" });
    }
    const de = await this.carregar(k.fromId);
    return { id: k.id, objeto: k.title, frase: k.note, ilustracao: k.svg, foto: k.imageId, de: de.nome, deId: de.id, deAvatar: de.avatar, reacao: (await this.pool.query<{ reaction: number | null }>(`SELECT reaction FROM "Keepsake" WHERE id=$1`, [k.id])).rows[0]?.reaction ?? null };
  }

  /** Quem recebeu reage (1 a 5). Quem mandou descobre a diferença entre o que previu e o que aconteceu. */
  async reagir(ator: Ator, keepsakeId: string, nota: unknown) {
    const n = nota15.parse(nota);
    z.uuid().parse(keepsakeId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    const r = await this.pool.query<{ fromId: string; predicted: number }>(
      `UPDATE "Keepsake" SET reaction=$3,"reactedAt"=clock_timestamp() WHERE id=$1 AND "toId"=$2 AND reaction IS NULL AND state='VISIBLE' RETURNING "fromId",predicted`, [keepsakeId, eu.id, n]);
    if (!r.rows[0]) throw new AuthError("CONFLICT", 409);
    void registrarEvento(this.pool, "estante_reacao", null, eu.id);
    const quem = await this.carregar(r.rows[0].fromId);
    if (quem.userId) await avisar(this.pool, quem.userId, "ESTANTE_REACAO", keepsakeId, { titulo: "Alguém reagiu à sua lembrança", corpo: `${eu.nome} reagiu a uma lembrança sua.`, url: "/estante" });
    return { previsto: r.rows[0].predicted, reacao: n, ...comparar(r.rows[0].predicted, n) };
  }

  /** A estante de quem está logado: o que recebeu, quem passou por lá e quantas visitas teve na semana. */
  async minhaEstante(ator: Ator) {
    const eu = await this.achar(ator);
    if (!eu) return null;
    const objetos = (await this.pool.query<{ id: string; title: string; note: string | null; svg: string | null; imageId: string | null; reaction: number | null; createdAt: Date; de: string; reagivel: boolean }>(
      `SELECT k.id,k.title,k.note,k."illustrationSvg" AS svg,k."imageId",k.reaction,k."createdAt",p.name AS de,(k.reaction IS NULL) AS reagivel
         FROM "Keepsake" k JOIN "ShelfPerson" p ON p.id=k."fromId" WHERE k."toId"=$1 AND k.state='VISIBLE' ORDER BY k."createdAt" DESC LIMIT 200`, [eu.id])).rows;
    const visitas = await this.visitasDaSemana(eu.id);
    return {
      pessoa: { id: eu.id, nome: eu.nome, convite: eu.inviteCode, avatar: eu.avatar },
      objetos: objetos.map((o) => ({ id: o.id, objeto: o.title, frase: o.note, ilustracao: o.svg, foto: o.imageId, de: o.de, reacao: o.reaction, em: o.createdAt, podeReagir: o.reagivel })),
      visitas,
    };
  }

  private async visitasDaSemana(donoId: string) {
    const total = await this.pool.query<{ n: string }>(`SELECT count(*) AS n FROM "ShelfVisit" WHERE "ownerId"=$1 AND day > current_date - 7`, [donoId]);
    const marcas = await this.pool.query<{ nome: string; day: string }>(
      `SELECT p.name AS nome,v.day::text AS day FROM "ShelfVisit" v JOIN "ShelfPerson" p ON p.id=v."visitorId" WHERE v."ownerId"=$1 AND v.mark AND v.day > current_date - 7 ORDER BY v.day DESC,p.name LIMIT 30`, [donoId]);
    return { naSemana: Number(total.rows[0]!.n), passaramPorAqui: marcas.rows.map((m) => ({ nome: m.nome, dia: m.day })) };
  }

  /** O que eu mandei e como foi recebido: a comparação entre o que previ e a reação. */
  async enviadas(ator: Ator) {
    const eu = await this.achar(ator);
    if (!eu) return [];
    const r = await this.pool.query<{ id: string; code: string; title: string; svg: string | null; imageId: string | null; predicted: number; reaction: number | null; para: string | null; toId: string | null; createdAt: Date }>(
      `SELECT k.id,k.code,k.title,k."illustrationSvg" AS svg,k."imageId",k.predicted,k.reaction,COALESCE(p.name,k."toName") AS para,k."toId",k."createdAt"
         FROM "Keepsake" k LEFT JOIN "ShelfPerson" p ON p.id=k."toId" WHERE k."fromId"=$1 AND k.state IN ('VISIBLE','PENDING','HIDDEN') ORDER BY k."createdAt" DESC LIMIT 100`, [eu.id]);
    return r.rows.map((x) => ({
      id: x.id, codigo: x.code, objeto: x.title, ilustracao: x.svg, foto: x.imageId, para: x.para, aberta: x.toId !== null, previsto: x.predicted, reacao: x.reaction, em: x.createdAt,
      ...(x.reaction !== null ? comparar(x.predicted, x.reaction) : {}),
    }));
  }

  /** Visitar a estante de alguém do círculo. Conta como visita (sem nome); a frase nunca aparece, exceto para quem a escreveu. */
  async estanteDe(ator: Ator, donoId: string) {
    z.uuid().parse(donoId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    if (eu.id === donoId) throw new AuthError("CONFLICT", 409);
    await this.exigirVinculoAtivo(eu.id, donoId);
    const dono = await this.carregar(donoId);
    await this.pool.query(`INSERT INTO "ShelfVisit"(id,"ownerId","visitorId",day) VALUES ($1,$2,$3,current_date) ON CONFLICT ("ownerId","visitorId",day) DO NOTHING`, [randomUUID(), donoId, eu.id]);
    void registrarEvento(this.pool, "estante_estante_vista", null, eu.id);
    const objetos = (await this.pool.query<{ id: string; title: string; svg: string | null; de: string; fromId: string; note: string | null; imageId: string | null }>(
      `SELECT k.id,k.title,k."illustrationSvg" AS svg,p.name AS de,k."fromId",k.note,k."imageId" FROM "Keepsake" k JOIN "ShelfPerson" p ON p.id=k."fromId" WHERE k."toId"=$1 AND k.state='VISIBLE' ORDER BY k."createdAt" DESC LIMIT 200`, [donoId])).rows;
    return { dono: { id: dono.id, nome: dono.nome, avatar: dono.avatar }, objetos: objetos.map((o) => ({ id: o.id, objeto: o.title, ilustracao: o.svg, de: o.de, frase: o.fromId === eu.id ? o.note : null, foto: o.fromId === eu.id ? o.imageId : null })) };
  }

  /** "Passei por aqui": a única visita que mostra o nome. Um por dia, por pessoa. */
  async marcar(ator: Ator, donoId: string): Promise<void> {
    z.uuid().parse(donoId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    if (eu.id === donoId) throw new AuthError("CONFLICT", 409);
    await this.exigirVinculoAtivo(eu.id, donoId);
    await limitar(this.pool, "estante", `marcar:${eu.id}`, 30, 86400);
    const r = await this.pool.query(
      `INSERT INTO "ShelfVisit"(id,"ownerId","visitorId",day,mark) VALUES ($1,$2,$3,current_date,true)
       ON CONFLICT ("ownerId","visitorId",day) DO UPDATE SET mark=true WHERE "ShelfVisit".mark=false`, [randomUUID(), donoId, eu.id]);
    if ((r.rowCount ?? 0) === 0) return;
    void registrarEvento(this.pool, "estante_pegada", null, eu.id);
    const dono = await this.carregar(donoId);
    if (dono.userId) await avisar(this.pool, dono.userId, "ESTANTE_PEGADA", randomUUID(), { titulo: "Passaram pela sua estante", corpo: `${eu.nome} passou por aqui.`, url: "/estante" }, { push: false });
  }

  /** Quem recebeu esconde um objeto da própria estante. */
  async ocultar(ator: Ator, keepsakeId: string): Promise<void> {
    z.uuid().parse(keepsakeId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    const r = await this.pool.query(`UPDATE "Keepsake" SET state='HIDDEN' WHERE id=$1 AND "toId"=$2 AND state='VISIBLE'`, [keepsakeId, eu.id]);
    if ((r.rowCount ?? 0) === 0) throw new AuthError("NOT_FOUND", 404);
  }

  /**
   * Denuncia uma lembrança recebida (texto ou foto). Ela some da estante de quem denunciou na hora, e a equipe
   * revisa por e-mail. Só quem recebeu denuncia; uma denúncia por pessoa e lembrança.
   */
  async denunciar(ator: Ator, keepsakeId: string, motivo: unknown): Promise<void> {
    z.uuid().parse(keepsakeId);
    const texto = z.string().trim().min(1).max(500).parse(motivo);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    await limitar(this.pool, "estante", `denunciar:${eu.id}`, 10, 86400);
    const k = await this.pool.query(`UPDATE "Keepsake" SET state='HIDDEN' WHERE id=$1 AND "toId"=$2 AND state IN ('VISIBLE','HIDDEN') RETURNING id`, [keepsakeId, eu.id]);
    if (!k.rows[0]) throw new AuthError("NOT_FOUND", 404);
    const id = randomUUID();
    const r = await this.pool.query(`INSERT INTO "ShelfReport"(id,"keepsakeId","reporterId",reason) VALUES ($1,$2,$3,$4) ON CONFLICT ("keepsakeId","reporterId") DO NOTHING`, [id, keepsakeId, eu.id, texto]);
    if ((r.rowCount ?? 0) > 0) await enviarDenunciaDaEstantePorEmail({ id, lembranca: keepsakeId, motivo: texto });
  }

  /** Quem mandou pode recolher a lembrança enquanto a pessoa ainda não reagiu. */
  async recolher(ator: Ator, keepsakeId: string): Promise<void> {
    z.uuid().parse(keepsakeId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    const r = await this.pool.query<{ imageId: string | null }>(`UPDATE "Keepsake" SET state='REMOVED' WHERE id=$1 AND "fromId"=$2 AND reaction IS NULL AND state IN ('VISIBLE','PENDING') RETURNING "imageId"`, [keepsakeId, eu.id]);
    if (!r.rows[0]) throw new AuthError("NOT_FOUND", 404);
    if (r.rows[0].imageId) await this.pool.query(`DELETE FROM "ShelfImage" WHERE id=$1`, [r.rows[0].imageId]);
  }

  // ---------- fotos ----------

  /**
   * Recebe uma foto, reduz e limpa (sem localização), passa pela moderação e só então guarda.
   * Uma foto recusada nunca é guardada; só fica o registro da decisão.
   */
  async subirImagem(ator: Ator, entrada: Buffer, finalidade: Finalidade) {
    z.enum(["avatar", "keepsake"]).parse(finalidade);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    if (!eu.idadeOk) throw new AuthError("AGE_REQUIRED", 403);
    if (!this.moderador.configurado()) throw new AuthError("SERVICE_UNAVAILABLE", 503);
    await limitar(this.pool, "estante", `foto:${eu.id}`, 30, 86400);
    await this.barrarInsistentes(eu.id);
    const img = await processarImagem(entrada, finalidade);
    await this.registrarVeredito(eu.id, "imagem", await this.moderador.imagem(img.bytes, img.mime), img.sha256);
    const id = randomUUID();
    await this.pool.query(`INSERT INTO "ShelfImage"(id,"ownerId",purpose,mime,bytes,width,height,"byteSize",sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
      [id, eu.id, finalidade, img.mime, img.bytes, img.largura, img.altura, img.bytes.length, img.sha256]);
    return { id, largura: img.largura, altura: img.altura };
  }

  /** Define a fotinha de perfil (a anterior é apagada). */
  async definirAvatar(ator: Ator, imageId: string): Promise<void> {
    z.uuid().parse(imageId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    const r = await this.pool.query(
      `UPDATE "ShelfPerson" SET "avatarImageId"=$2 WHERE id=$1 AND EXISTS (SELECT 1 FROM "ShelfImage" WHERE id=$2 AND "ownerId"=$1 AND purpose='avatar')`, [eu.id, imageId]);
    if ((r.rowCount ?? 0) === 0) throw new AuthError("NOT_FOUND", 404);
    if (eu.avatar && eu.avatar !== imageId) await this.pool.query(`DELETE FROM "ShelfImage" WHERE id=$1 AND purpose='avatar'`, [eu.avatar]);
  }
  async removerAvatar(ator: Ator): Promise<void> {
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    await this.pool.query(`UPDATE "ShelfPerson" SET "avatarImageId"=NULL WHERE id=$1`, [eu.id]);
    if (eu.avatar) await this.pool.query(`DELETE FROM "ShelfImage" WHERE id=$1 AND purpose='avatar'`, [eu.avatar]);
  }

  /**
   * Entrega uma foto a quem pode vê-la. A fotinha: a própria pessoa e o círculo. A foto de uma lembrança:
   * só quem deu e quem recebeu. Qualquer outro caso responde "não existe", sem dizer que existe.
   */
  async imagem(ator: Ator, imageId: string): Promise<{ bytes: Buffer; mime: string; nome: string }> {
    if (!z.uuid().safeParse(imageId).success) throw new AuthError("NOT_FOUND", 404);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("NOT_FOUND", 404);
    const im = (await this.pool.query<{ ownerId: string; purpose: string; bytes: Buffer; mime: string }>(`SELECT "ownerId",purpose,bytes,mime FROM "ShelfImage" WHERE id=$1`, [imageId])).rows[0];
    if (!im) throw new AuthError("NOT_FOUND", 404);
    let pode = im.ownerId === eu.id;
    if (!pode && im.purpose === "avatar") pode = (await this.vinculo(eu.id, im.ownerId))?.status === "ACTIVE";
    if (!pode && im.purpose === "keepsake") pode = ((await this.pool.query(`SELECT 1 FROM "Keepsake" WHERE "imageId"=$1 AND "toId"=$2 AND state='VISIBLE'`, [imageId, eu.id])).rowCount ?? 0) > 0;
    if (!pode) throw new AuthError("NOT_FOUND", 404);
    return { bytes: im.bytes, mime: im.mime, nome: `orvok-${imageId.slice(0, 8)}.webp` };
  }

  // ---------- ilustração do objeto ----------

  /**
   * Garante o desenho do objeto de uma lembrança (quem deu ou quem recebeu pode pedir). O mesmo nome
   * reaproveita o mesmo desenho para todos, o que custa menos e mantém o estilo. Se não for possível
   * desenhar agora (sem chave, limite do dia, recusa do filtro), devolve null e a tela mostra o desenho
   * de reserva; dá para tentar de novo depois.
   */
  async ilustrar(ator: Ator, keepsakeId: string): Promise<{ ilustracao: string | null; gerada: boolean; motivo?: string }> {
    z.uuid().parse(keepsakeId);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    const k = (await this.pool.query<{ title: string; svg: string | null; fromId: string; toId: string | null }>(
      `SELECT title,"illustrationSvg" AS svg,"fromId","toId" FROM "Keepsake" WHERE id=$1 AND state IN ('VISIBLE','PENDING')`, [keepsakeId])).rows[0];
    if (!k || (k.fromId !== eu.id && k.toId !== eu.id)) throw new AuthError("NOT_FOUND", 404);
    if (k.svg) return { ilustracao: k.svg, gerada: false };
    const chave = createHash("sha256").update(normalizarObjeto(k.title) || k.title).digest("hex");
    let svg = (await this.pool.query<{ svg: string }>(`SELECT svg FROM "ShelfIllustration" WHERE "key"=$1`, [chave])).rows[0]?.svg ?? null;
    if (!svg) {
      if (!this.ilustrador.configurado()) return { ilustracao: null, gerada: false, motivo: "indisponivel" };
      await limitar(this.pool, "estante", `ilustrar:${eu.id}`, 40, 86400);
      const teto = Number(process.env.ORVOK_ILUSTRACOES_POR_DIA ?? 300);
      const hoje = Number((await this.pool.query<{ n: string }>(`SELECT count(*) AS n FROM "ShelfIllustration" WHERE "createdAt" > clock_timestamp() - interval '24 hours'`)).rows[0]!.n);
      if (hoje >= teto) return { ilustracao: null, gerada: false, motivo: "limite_diario" };
      svg = await this.ilustrador.gerar(k.title);
      if (!svg) return { ilustracao: null, gerada: false, motivo: "indisponivel" };
      await this.pool.query(`INSERT INTO "ShelfIllustration"("key",svg) VALUES ($1,$2) ON CONFLICT ("key") DO NOTHING`, [chave, svg]);
    }
    await this.pool.query(`UPDATE "Keepsake" SET "illustrationSvg"=$2 WHERE id=$1 AND "illustrationSvg" IS NULL`, [keepsakeId, svg]);
    return { ilustracao: svg, gerada: true };
  }

  // ---------- álbuns (montam-se sozinhos) ----------

  /** Os álbuns de quem está logado: por quem deu, por ano, os mais amados e "o álbum de vocês dois". */
  async albuns(ator: Ator) {
    const eu = await this.achar(ator);
    if (!eu) return null;
    const deQuem = await this.pool.query<{ id: string; name: string; n: number }>(
      `SELECT p.id,p.name,count(*)::int AS n FROM "Keepsake" k JOIN "ShelfPerson" p ON p.id=k."fromId" WHERE k."toId"=$1 AND k.state='VISIBLE' GROUP BY p.id,p.name ORDER BY max(k."createdAt") DESC`, [eu.id]);
    const anos = await this.pool.query<{ ano: number; n: number }>(
      `SELECT extract(year FROM "createdAt")::int AS ano,count(*)::int AS n FROM "Keepsake" WHERE "toId"=$1 AND state='VISIBLE' GROUP BY 1 ORDER BY 1 DESC`, [eu.id]);
    const amadas = await this.pool.query<{ n: string }>(`SELECT count(*) AS n FROM "Keepsake" WHERE "toId"=$1 AND state='VISIBLE' AND reaction=5`, [eu.id]);
    const dois = await this.pool.query<{ id: string; name: string; n: number }>(
      `SELECT p.id,p.name,count(*)::int AS n FROM "Keepsake" k
         JOIN "ShelfPerson" p ON p.id = CASE WHEN k."fromId"=$1 THEN k."toId" ELSE k."fromId" END
         JOIN "ShelfBond" b ON b."personA"=LEAST(k."fromId",k."toId") AND b."personB"=GREATEST(k."fromId",k."toId") AND b.status='ACTIVE'
        WHERE (k."fromId"=$1 OR k."toId"=$1) AND k."toId" IS NOT NULL AND k.state='VISIBLE' GROUP BY p.id,p.name ORDER BY max(k."createdAt") DESC`, [eu.id]);
    return {
      deQuem: deQuem.rows.map((x) => ({ pessoaId: x.id, nome: x.name, quantidade: x.n })),
      anos: anos.rows.map((x) => ({ ano: x.ano, quantidade: x.n })),
      amadas: Number(amadas.rows[0]!.n),
      vocesDois: dois.rows.map((x) => ({ pessoaId: x.id, nome: x.name, quantidade: x.n })),
    };
  }

  /** O conteúdo de um álbum. "vocesDois" mostra a história da relação em ordem, com as duas direções. */
  async album(ator: Ator, raw: unknown) {
    const d = z.discriminatedUnion("tipo", [
      z.strictObject({ tipo: z.literal("de"), pessoaId: z.uuid() }),
      z.strictObject({ tipo: z.literal("ano"), ano: z.number().int().min(2020).max(2100) }),
      z.strictObject({ tipo: z.literal("amadas") }),
      z.strictObject({ tipo: z.literal("vocesDois"), pessoaId: z.uuid() }),
    ]).parse(raw);
    const eu = await this.achar(ator);
    if (!eu) throw new AuthError("UNAUTHENTICATED", 401);
    let onde: string; let params: unknown[]; let ordem = "DESC";
    if (d.tipo === "de") { onde = `k."toId"=$1 AND k."fromId"=$2`; params = [eu.id, d.pessoaId]; }
    else if (d.tipo === "ano") { onde = `k."toId"=$1 AND extract(year FROM k."createdAt")=$2`; params = [eu.id, d.ano]; }
    else if (d.tipo === "amadas") { onde = `k."toId"=$1 AND k.reaction=5`; params = [eu.id]; }
    else {
      await this.exigirVinculoAtivo(eu.id, d.pessoaId);
      onde = `((k."fromId"=$1 AND k."toId"=$2) OR (k."fromId"=$2 AND k."toId"=$1))`; params = [eu.id, d.pessoaId]; ordem = "ASC";
    }
    const r = await this.pool.query<{ id: string; title: string; note: string | null; svg: string | null; imageId: string | null; predicted: number; reaction: number | null; createdAt: Date; fromId: string; de: string; para: string }>(
      `SELECT k.id,k.title,k.note,k."illustrationSvg" AS svg,k."imageId",k.predicted,k.reaction,k."createdAt",k."fromId",pf.name AS de,pt.name AS para
         FROM "Keepsake" k JOIN "ShelfPerson" pf ON pf.id=k."fromId" JOIN "ShelfPerson" pt ON pt.id=k."toId"
        WHERE ${onde} AND k.state='VISIBLE' ORDER BY k."createdAt" ${ordem} LIMIT 300`, params);
    return r.rows.map((x) => ({
      id: x.id, objeto: x.title, frase: x.note, ilustracao: x.svg, foto: x.imageId, de: x.de, para: x.para, souEuQuemDeu: x.fromId === eu.id,
      previsto: x.predicted, reacao: x.reaction, em: x.createdAt, ...(x.reaction !== null ? comparar(x.predicted, x.reaction) : {}),
    }));
  }
}

/** Sem exagero: só destaca a surpresa quando ela é boa; senão, fala o que aconteceu. */
export function comparar(previsto: number, reacao: number): { diferenca: number; frase: string } {
  const diferenca = reacao - previsto;
  if (diferenca > 0) return { diferenca, frase: "Gostaram mais do que você imaginou." };
  if (diferenca === 0) return { diferenca, frase: "Foi do jeito que você imaginou." };
  return { diferenca, frase: "Foi recebido com menos entusiasmo do que você esperava. O gesto continua valendo." };
}

import { randomInt, randomUUID } from "node:crypto";
import type { Pool } from "pg";
import { z } from "zod";
import { randomToken, tokenHash } from "@/lib/auth/crypto";
import { AuthError } from "@/lib/auth/session";
import { AVISO_IDADE_HASH, AVISO_IDADE_VERSAO } from "@/lib/desafio/catalogo";
import { registrarEvento } from "@/lib/medicao";
import { enviarPush } from "@/lib/push";

/** Notifica e, se a pessoa ativou, manda um aviso push com o selo atualizado. */
async function avisar(pool: Pool, recipientId: string, eventType: string, sourceId: string, aviso: { titulo: string; corpo: string; url: string }): Promise<void> {
  await pool.query(`SELECT orvok_social_notify($1,$2,$3::uuid)`, [recipientId, eventType, sourceId]).catch(() => undefined);
  const n = await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "Notification" WHERE "recipientId"=$1 AND state='UNREAD'`, [recipientId]).catch(() => null);
  await enviarPush(pool, recipientId, { ...aviso, selo: n ? Number(n.rows[0]!.n) : undefined }).catch(() => undefined);
}

/**
 * Mundo entre pessoas. O evento externo é só o assunto: cada uma das duas
 * pessoas diz, em segredo, o que acha que vai acontecer. Nada é revelado antes
 * do encerramento do evento; depois, as duas descobrem se pensaram igual.
 * O modo só define quem responde primeiro (os valores guardados no banco
 * continuam os mesmos desde o começo):
 *   ser_previsto: quem criou responde agora e depois convida.
 *   prever:       quem criou convida primeiro; o convidado responde e, em seguida, quem criou.
 * "answer*" guarda a opinião de quem responde primeiro e "guess*" a de quem responde depois.
 */
export const CATEGORIAS = { economia: "Economia", tecnologia: "Tecnologia", esporte: "Esporte", entretenimento: "Entretenimento" } as const;
export type Categoria = keyof typeof CATEGORIAS;
export type Modo = "ser_previsto" | "prever";
const TRAVA_MS = 10 * 60 * 1000;
const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const codigo = () => Array.from({ length: 8 }, () => ALFABETO[randomInt(ALFABETO.length)]).join("");
const codigoSchema = z.string().regex(/^[A-HJ-NP-Z2-9]{8}$/);
const nomeSchema = z.string().transform((v) => v.trim().replace(/\s+/g, " ")).pipe(z.string().min(2).max(24));
const idadeSchema = z.strictObject({ aceito: z.literal(true), versao: z.literal(AVISO_IDADE_VERSAO), hash: z.literal(AVISO_IDADE_HASH) });

type Evento = { id: string; title: string; category: string; status: string; closesAt: Date; opps: { id: string; label: string; position: number }[]; resultado: string | null };
type Rodada = {
  id: string; code: string; eventId: string; mode: Modo; initiatorUserId: string; initiatorName: string;
  guestName: string | null; guestTokenHash: string | null; guestUserId: string | null;
  answerOpportunityId: string | null; guessOpportunityId: string | null; guessUnsure: boolean; createdAt: Date;
};

/** Estado da rodada, do jeito que as duas pessoas podem ver. */
export type Estado = "aguardando_convidado" | "aguardando_criador" | "aguardando_revelacao" | "revelada" | "sem_comparacao" | "cancelada";

export class MundoService {
  constructor(private readonly pool: Pool) {}

  private async eventos(ids?: string[]): Promise<Evento[]> {
    const r = await this.pool.query<{ id: string; title: string; category: string; status: string; closesAt: Date; opps: Evento["opps"]; resultado: string | null }>(
      `SELECT e.id,e.title,(SELECT c.slug FROM "WorldCategory" c WHERE c.id=e."categoryId") AS category,e.status,e."closesAt",
              (SELECT jsonb_agg(jsonb_build_object('id',o.id,'label',o.label,'position',o.position) ORDER BY o.position) FROM "WorldOpportunity" o WHERE o."eventId"=e.id) AS opps,
              (SELECT o.label FROM "WorldResolution" res JOIN "WorldOpportunity" o ON o.id=res."outcomeOpportunityId" WHERE res."eventId"=e.id) AS resultado
         FROM "WorldEvent" e
        WHERE ${ids ? `e.id = ANY($1::uuid[])` : `e.status='PUBLISHED' AND e."closesAt" > clock_timestamp() + interval '10 minutes'`}
        ORDER BY e."closesAt" ASC LIMIT 60`,
      ids ? [ids] : [],
    );
    return r.rows.map((e) => ({ ...e, opps: e.opps ?? [] }));
  }

  /** Eventos abertos da semana, agrupados pelas 4 categorias. */
  async eventosAbertos() {
    return (await this.eventos()).map((e) => ({
      id: e.id, titulo: e.title, categoria: (e.category in CATEGORIAS ? e.category : "entretenimento") as Categoria,
      encerraEm: e.closesAt, opcoes: e.opps.map((o) => ({ id: o.id, rotulo: o.label })),
    }));
  }

  private estado(r: Rodada, e: Evento): Estado {
    if (["CANCELLED", "VOID"].includes(e.status)) return "cancelada";
    const encerrou = e.closesAt.getTime() <= Date.now() || ["CLOSED", "RESOLVED"].includes(e.status);
    const completa = Boolean(r.answerOpportunityId) && (Boolean(r.guessOpportunityId) || r.guessUnsure);
    if (encerrou) return completa ? "revelada" : "sem_comparacao";
    if (!r.answerOpportunityId) return "aguardando_convidado";
    if (!r.guessOpportunityId && !r.guessUnsure) return r.mode === "ser_previsto" ? "aguardando_convidado" : "aguardando_criador";
    return "aguardando_revelacao";
  }

  /** Visão de uma conversa para um dos dois lados. Só revela as opiniões quando o estado é "revelada". */
  private visao(r: Rodada, e: Evento, lado: "criador" | "convidado") {
    const est = this.estado(r, e);
    const rotulo = (id: string | null) => e.opps.find((o) => o.id === id)?.label ?? null;
    const ladoPrimeiro = r.mode === "ser_previsto" ? "criador" : "convidado";
    const primeiro = r.mode === "ser_previsto" ? r.initiatorName : r.guestName;
    const segundo = r.mode === "ser_previsto" ? r.guestName : r.initiatorName;
    const revelada = est === "revelada";
    return {
      codigo: r.code, modo: r.mode, estado: est, lado,
      evento: { titulo: e.title, categoria: e.category, encerraEm: e.closesAt, opcoes: e.opps.map((o) => ({ id: o.id, rotulo: o.label })), resultado: revelada ? e.resultado : null },
      criador: r.initiatorName, convidado: r.guestName, primeiro, segundo,
      // O que esta pessoa ainda precisa fazer.
      minhaVez: est !== "revelada" && est !== "sem_comparacao" && est !== "cancelada" && (
        lado === "convidado" ? (r.mode === "prever" ? !r.answerOpportunityId : !r.guessOpportunityId && !r.guessUnsure)
          : (r.mode === "prever" && Boolean(r.answerOpportunityId) && !r.guessOpportunityId && !r.guessUnsure)),
      // A própria opinião cada um vê; a da outra pessoa só aparece depois do evento.
      minhaOpiniao: lado === ladoPrimeiro ? rotulo(r.answerOpportunityId) : (r.guessUnsure ? "Prefiro não opinar" : rotulo(r.guessOpportunityId)),
      revelacao: revelada ? {
        primeiraOpiniao: rotulo(r.answerOpportunityId), segundaOpiniao: r.guessUnsure ? null : rotulo(r.guessOpportunityId), semOpiniao: r.guessUnsure,
        igual: !r.guessUnsure && r.guessOpportunityId === r.answerOpportunityId,
      } : null,
    };
  }

  private async rodadaPorCodigo(cod: string) {
    const r = await this.pool.query<Rodada>(`SELECT * FROM "WorldRound" WHERE code=$1 AND "revokedAt" IS NULL`, [codigoSchema.parse(cod)]);
    const rodada = r.rows[0];
    if (!rodada) throw new AuthError("NOT_FOUND", 404);
    const [e] = await this.eventos([rodada.eventId]);
    if (!e) throw new AuthError("NOT_FOUND", 404);
    return { rodada, e };
  }

  private aberto(e: Evento) {
    if (e.status !== "PUBLISHED" || e.closesAt.getTime() - TRAVA_MS <= Date.now()) throw new AuthError("CONFLICT", 409);
  }

  /** Quem está logado abre uma conversa. Em "ser_previsto" já registra a própria opinião, em segredo. */
  async criar(raw: unknown, userId: string) {
    const d = z.strictObject({ eventoId: z.uuid(), modo: z.enum(["ser_previsto", "prever"]), resposta: z.uuid().optional(), nome: nomeSchema }).parse(raw);
    const nome = d.nome;
    const [e] = await this.eventos([d.eventoId]);
    if (!e) throw new AuthError("NOT_FOUND", 404);
    this.aberto(e);
    if (d.modo === "ser_previsto" && !e.opps.some((o) => o.id === d.resposta)) throw new AuthError("INVALID_INPUT", 400);
    const cod = codigo();
    await this.pool.query(
      `INSERT INTO "WorldRound" (id,code,"eventId",mode,"initiatorUserId","initiatorName","answerOpportunityId","answeredAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7::uuid,CASE WHEN $7::uuid IS NULL THEN NULL ELSE clock_timestamp() END)`,
      [randomUUID(), cod, e.id, d.modo, userId, nomeSchema.parse(nome), d.modo === "ser_previsto" ? d.resposta : null],
    );
    await registrarEvento(this.pool, "mundo_rodada_criada", cod, userId);
    return { codigo: cod };
  }

  /** Página do convidado: o que ele pode ver agora. */
  async verComoConvidado(cod: string, token: string | null) {
    const { rodada, e } = await this.rodadaPorCodigo(cod);
    if (rodada.guestTokenHash && rodada.guestTokenHash !== (token ? tokenHash(token) : "")) throw new AuthError("FORBIDDEN", 403);
    await registrarEvento(this.pool, "mundo_convite_aberto", cod, token ? tokenHash(token) : null);
    return this.visao(rodada, e, "convidado");
  }

  /** O convidado dá a sua opinião, em segredo. O primeiro aparelho fica com a vaga. */
  async participar(cod: string, raw: unknown, tokenAtual: string | null, userId: string | null) {
    const d = z.strictObject({ nome: nomeSchema, opcao: z.uuid().nullable(), consentimentoIdade: idadeSchema }).parse(raw);
    const { rodada, e } = await this.rodadaPorCodigo(cod);
    this.aberto(e);
    const token = tokenAtual ?? randomToken();
    const hash = tokenHash(token);
    if (userId && userId === rodada.initiatorUserId) throw new AuthError("OWN_CHALLENGE", 409);
    if (rodada.guestTokenHash && rodada.guestTokenHash !== hash) throw new AuthError("FORBIDDEN", 403);
    if (d.opcao && !e.opps.some((o) => o.id === d.opcao)) throw new AuthError("INVALID_INPUT", 400);
    if (rodada.mode === "prever") {
      if (!d.opcao) throw new AuthError("INVALID_INPUT", 400); // a própria opinião não pode ser "não sei"
      if (rodada.answerOpportunityId) throw new AuthError("CONFLICT", 409);
      await this.pool.query(`UPDATE "WorldRound" SET "guestName"=$2,"guestTokenHash"=$3,"guestUserId"=$4::uuid,"answerOpportunityId"=$5,"answeredAt"=clock_timestamp(),"ageConsentVersion"=$6 WHERE id=$1`,
        [rodada.id, d.nome, hash, userId, d.opcao, AVISO_IDADE_VERSAO]);
    } else {
      if (rodada.guessOpportunityId || rodada.guessUnsure) throw new AuthError("CONFLICT", 409);
      await this.pool.query(`UPDATE "WorldRound" SET "guestName"=$2,"guestTokenHash"=$3,"guestUserId"=$4::uuid,"guessOpportunityId"=$5::uuid,"guessUnsure"=$6,"guessedAt"=clock_timestamp(),"ageConsentVersion"=$7 WHERE id=$1`,
        [rodada.id, d.nome, hash, userId, d.opcao, d.opcao === null, AVISO_IDADE_VERSAO]);
    }
    await registrarEvento(this.pool, "mundo_convidado_participou", cod, hash);
    // No modo "prever", a opinião do convidado libera a vez de quem criou responder.
    if (rodada.mode === "prever") {
      await avisar(this.pool, rodada.initiatorUserId, "MUNDO_SUA_VEZ", rodada.id, {
        titulo: "É a sua vez no Mundo", corpo: `${d.nome} já compartilhou o que acha sobre "${e.title}". Agora é a sua vez.`, url: "/eventos",
      });
    }
    const atual = await this.rodadaPorCodigo(cod);
    return { ...this.visao(atual.rodada, atual.e, "convidado"), token };
  }

  /** Quem criou dá a sua opinião depois do convidado (modo prever). */
  async opinar(cod: string, raw: unknown, userId: string) {
    const d = z.strictObject({ opcao: z.uuid().nullable() }).parse(raw);
    const { rodada, e } = await this.rodadaPorCodigo(cod);
    if (rodada.initiatorUserId !== userId || rodada.mode !== "prever") throw new AuthError("FORBIDDEN", 403);
    this.aberto(e);
    if (!rodada.answerOpportunityId || rodada.guessOpportunityId || rodada.guessUnsure) throw new AuthError("CONFLICT", 409);
    if (d.opcao && !e.opps.some((o) => o.id === d.opcao)) throw new AuthError("INVALID_INPUT", 400);
    await this.pool.query(`UPDATE "WorldRound" SET "guessOpportunityId"=$2::uuid,"guessUnsure"=$3,"guessedAt"=clock_timestamp() WHERE id=$1`, [rodada.id, d.opcao, d.opcao === null]);
    await registrarEvento(this.pool, "mundo_opiniao", cod, userId);
    const atual = await this.rodadaPorCodigo(cod);
    return this.visao(atual.rodada, atual.e, "criador");
  }

  /**
   * Minhas conexões: para cada pessoa com quem a conta já conversou no Mundo,
   * em quantos assuntos vocês pensaram igual e em quantos pensaram diferente.
   * É simétrico (pensar igual vale para os dois lados), não há pontuação nem
   * ordem de "melhor": quem escolheu não opinar e eventos cancelados ou sem
   * as duas opiniões não entram na conta.
   */
  async conexoes(userId: string, token: string | null) {
    const meuHash = token ? tokenHash(token) : "";
    const r = await this.pool.query<Rodada>(
      `SELECT * FROM "WorldRound" WHERE "revokedAt" IS NULL AND ("initiatorUserId"=$1 OR "guestUserId"=$1 OR "guestTokenHash"=$2) ORDER BY "createdAt" ASC`,
      [userId, meuHash],
    );
    const evs = new Map((await this.eventos([...new Set(r.rows.map((x) => x.eventId))])).map((e) => [e.id, e]));
    type Pessoa = {
      chave: string; nome: string; igual: number; diferente: number; semOpiniao: number; pendentes: number; ultima: Date;
      porCategoria: Record<string, { iguais: number; total: number }>;
      historico: { data: Date; categoria: string; evento: string; suaOpiniao: string | null; opiniaoDela: string | null; resultado: "igual" | "diferente" | "sem_opiniao" }[];
    };
    const pessoas = new Map<string, Pessoa>();
    const andamento = [];
    const aberto = (est: Estado) => ["aguardando_convidado", "aguardando_criador", "aguardando_revelacao"].includes(est);
    for (const x of r.rows) {
      const e = evs.get(x.eventId);
      if (!e) continue;
      const souCriador = x.initiatorUserId === userId;
      const outraChave = souCriador ? (x.guestUserId ?? x.guestTokenHash) : x.initiatorUserId;
      const outraNome = souCriador ? x.guestName : x.initiatorName;
      const est = this.estado(x, e);
      if (aberto(est)) andamento.push(this.visao(x, e, souCriador ? "criador" : "convidado"));
      if (!outraChave || !outraNome) continue;
      const p = pessoas.get(outraChave) ?? { chave: outraChave, nome: outraNome, igual: 0, diferente: 0, semOpiniao: 0, pendentes: 0, ultima: x.createdAt, porCategoria: {}, historico: [] };
      p.nome = outraNome; if (x.createdAt > p.ultima) p.ultima = x.createdAt;
      if (aberto(est)) p.pendentes++;
      if (est === "revelada") {
        const resultado = x.guessUnsure ? "sem_opiniao" : x.guessOpportunityId === x.answerOpportunityId ? "igual" : "diferente";
        if (resultado === "sem_opiniao") p.semOpiniao++; else if (resultado === "igual") p.igual++; else p.diferente++;
        const cat = e.category in CATEGORIAS ? e.category : "entretenimento";
        if (resultado !== "sem_opiniao") {
          const c = p.porCategoria[cat] ?? { iguais: 0, total: 0 };
          c.total++; if (resultado === "igual") c.iguais++;
          p.porCategoria[cat] = c;
        }
        const rotulo = (id: string | null) => e.opps.find((o) => o.id === id)?.label ?? null;
        const euPrimeiro = (x.mode === "ser_previsto") === souCriador;
        const primeira = rotulo(x.answerOpportunityId), segunda = x.guessUnsure ? null : rotulo(x.guessOpportunityId);
        p.historico.unshift({ data: e.closesAt, categoria: cat, evento: e.title, suaOpiniao: euPrimeiro ? primeira : segunda, opiniaoDela: euPrimeiro ? segunda : primeira, resultado });
      }
      pessoas.set(outraChave, p);
    }
    const lista = [...pessoas.values()].map((p) => ({ ...p, conversas: p.igual + p.diferente + p.semOpiniao }))
      .sort((a, b) => b.igual - a.igual || b.conversas - a.conversas || +b.ultima - +a.ultima);
    const soma = (f: (p: (typeof lista)[number]) => number) => lista.reduce((n, p) => n + f(p), 0);
    return {
      resumo: { conversas: soma((p) => p.conversas), pensaramIgual: soma((p) => p.igual), pendentes: andamento.length },
      pessoas: lista.map(({ chave, ...p }) => ({ id: tokenHash(chave).slice(0, 12), ...p })),
      andamento,
    };
  }

  /** Rodadas de quem está logado: as que criou e as que recebeu como convidado. */
  async minhas(userId: string, token: string | null) {
    const r = await this.pool.query<Rodada>(
      `SELECT * FROM "WorldRound" WHERE "revokedAt" IS NULL AND ("initiatorUserId"=$1 OR "guestUserId"=$1 OR "guestTokenHash"=$2) ORDER BY "createdAt" DESC LIMIT 100`,
      [userId, token ? tokenHash(token) : ""],
    );
    const evs = new Map((await this.eventos([...new Set(r.rows.map((x) => x.eventId))])).map((e) => [e.id, e]));
    return r.rows.filter((x) => evs.has(x.eventId)).map((x) => this.visao(x, evs.get(x.eventId)!, x.initiatorUserId === userId ? "criador" : "convidado"));
  }
}

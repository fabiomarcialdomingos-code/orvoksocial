import type { Pool } from "pg";
import { tokenHash } from "@/lib/auth/crypto";
import { perguntaPublica } from "@/lib/desafio/catalogo";
import { perguntaPorChave } from "@/lib/desafio/selecao";
import { MundoService } from "@/lib/mundo/service";

const LETRAS = ["A", "B", "C", "D"];
const texto = (chave: string, letra: string, nome: string | null) => {
  const p = perguntaPorChave(chave);
  if (!p) return { pergunta: chave, resposta: letra };
  const q = perguntaPublica(p, nome);
  return { pergunta: q.texto, resposta: q.opcoes[LETRAS.indexOf(letra)] ?? letra };
};

/**
 * Tudo o que o orvok guarda sobre uma pessoa nos convites, no retrato e no Mundo,
 * para a exportação de dados (LGPD). Reúne o que está ligado à conta e ao aparelho
 * atual. Não inclui nada que identifique outras pessoas: quem respondeu de forma
 * anônima sobre o retrato aparece só como contagem, e do outro lado de uma
 * conversa só o nome que a própria pessoa escolheu usar.
 */
export async function exportarConvitesEMundo(pool: Pool, userId: string, token: string | null) {
  const hash = token ? tokenHash(token) : "";
  const meu = `("ownerTokenHash"=$1 OR "claimedByUserId"=$2::uuid)`;

  const convites = (await pool.query<{ id: string; code: string; creatorName: string; relation: string; createdAt: Date; expiresAt: Date; revokedAt: Date | null; answers: string[]; questionKeys: string[]; consentNoticeVersion: string; consentedAt: Date | null; visoes: number }>(
    `SELECT c.id,c.code,c."creatorName",c.relation,c."createdAt",c."expiresAt",c."revokedAt",c.answers,c."questionKeys",c."consentNoticeVersion",c."consentedAt",
            (SELECT count(*)::int FROM "GuestChallengeAttempt" a WHERE a."challengeId"=c.id) AS visoes
       FROM "GuestChallenge" c WHERE c."ownerTokenHash"=$1 OR c."claimedByUserId"=$2::uuid ORDER BY c."createdAt" DESC LIMIT 200`, [hash, userId])).rows
    .map((c) => ({
      codigo: c.code, relacao: c.relation, nome: c.creatorName, criadoEm: c.createdAt, expiraEm: c.expiresAt, canceladoEm: c.revokedAt,
      aceiteVersao: c.consentNoticeVersion, aceiteEm: c.consentedAt,
      minhasRespostas: c.questionKeys.map((k, i) => texto(k, c.answers[i] ?? "", null)),
      visoesRecebidas: c.visoes, // só a contagem: quem respondeu é anônimo
    }));

  const visoesQueCompartilhei = (await pool.query<{ code: string; creatorName: string; relation: string; questionKeys: string[]; predictions: string[]; createdAt: Date; ageConsentVersion: string | null }>(
    `SELECT c.code,c."creatorName",c.relation,c."questionKeys",a.predictions,a."createdAt",a."ageConsentVersion"
       FROM "GuestChallengeAttempt" a JOIN "GuestChallenge" c ON c.id=a."challengeId"
      WHERE a."ownerTokenHash"=$1 OR a."claimedByUserId"=$2::uuid ORDER BY a."createdAt" DESC LIMIT 200`, [hash, userId])).rows
    .map((a) => ({
      convite: a.code, sobre: a.creatorName, relacao: a.relation, em: a.createdAt, confirmacaoDeIdadeVersao: a.ageConsentVersion,
      minhasRespostas: a.questionKeys.map((k, i) => texto(k, a.predictions[i] ?? "", a.creatorName)),
    }));

  const ocultos = (await pool.query<{ traco: string }>(`SELECT traco FROM "HiddenTrait" WHERE ${meu}`, [hash, userId])).rows.map((x) => x.traco);
  const evolucaoDoSelo = (await pool.query(`SELECT "createdAt" AS "em",respondentes,batem,nivel FROM "RetratoSnapshot" WHERE ${meu} ORDER BY "createdAt" ASC LIMIT 500`, [hash, userId])).rows;
  const idade = (await pool.query<{ version: string; createdAt: Date }>(`SELECT version,"createdAt" FROM "UserAgeConsent" WHERE "userId"=$1`, [userId])).rows[0];
  const aparelhos = Number((await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "PushSubscription" WHERE "userId"=$1`, [userId])).rows[0]!.n);
  const denuncias = (await pool.query(`SELECT r."createdAt" AS "em",r.reason AS "motivo",c.code AS "convite" FROM "GuestReport" r JOIN "GuestChallenge" c ON c.id=r."challengeId" WHERE r."reporterTokenHash"=$1 OR r."reporterUserId"=$2::uuid ORDER BY r."createdAt" DESC LIMIT 200`, [hash, userId])).rows;
  const bloqueios = Number((await pool.query<{ n: string }>(`SELECT count(*) AS n FROM "GuestBlock" WHERE "blockerTokenHash"=$1 OR "blockerUserId"=$2::uuid`, [hash, userId])).rows[0]!.n);

  // Mundo: a mesma visão que a pessoa vê no app (só a própria opinião; a da outra só depois de revelada).
  const mundo = (await new MundoService(pool).minhas(userId, token)).map((r) => ({
    conversa: r.codigo, evento: r.evento.titulo, categoria: r.evento.categoria, encerraEm: r.evento.encerraEm,
    meuLado: r.lado === "criador" ? "criei a conversa" : "fui convidado", com: r.lado === "criador" ? r.convidado : r.criador,
    minhaOpiniao: r.minhaOpiniao, estado: r.estado, revelacao: r.revelacao,
  }));

  // Conversas privadas (mensagens ainda dentro do prazo de 90 dias).
  const fios = (await pool.query<{ id: string; code: string; proposerSide: string; status: string; createdAt: Date; initiatorUserId: string; initiatorName: string; guestName: string | null }>(
    `SELECT t.id,w.code,t."proposerSide",t.status,t."createdAt",w."initiatorUserId",w."initiatorName",w."guestName"
       FROM "RoundThread" t JOIN "WorldRound" w ON w.id=t."roundId"
      WHERE w."initiatorUserId"=$2::uuid OR w."guestUserId"=$2::uuid OR w."guestTokenHash"=$1 ORDER BY t."createdAt" DESC LIMIT 200`, [hash, userId])).rows;
  const conversas = [];
  for (const f of fios) {
    const meuLado = f.initiatorUserId === userId ? "criador" : "convidado";
    const msgs = (await pool.query<{ side: string; body: string; createdAt: Date }>(`SELECT side,body,"createdAt" FROM "RoundMessage" WHERE "threadId"=$1 ORDER BY "createdAt" ASC LIMIT 300`, [f.id])).rows;
    conversas.push({
      conversa: f.code, com: meuLado === "criador" ? f.guestName : f.initiatorName, estado: f.status, propostaPor: f.proposerSide === meuLado ? "mim" : "a outra pessoa", criadaEm: f.createdAt,
      mensagens: msgs.map((m) => ({ minha: m.side === meuLado, texto: m.body, em: m.createdAt })),
      observacao: "As mensagens são apagadas automaticamente depois de 90 dias.",
    });
  }

  return {
    convites, visoesQueCompartilhei, tracosQueGuardoSoParaMim: ocultos, evolucaoDoSelo, mundo, conversas,
    confirmacaoDeIdade: idade ? { versao: idade.version, em: idade.createdAt } : null,
    aparelhosComAvisos: aparelhos, denunciasQueFiz: denuncias, bloqueiosQueFiz: bloqueios,
  };
}

// Limpeza: apaga tudo que a simulação criou e PROVA que o banco voltou ao que era.
// Tudo é identificado por marca (nomes que começam com "SIM", e-mails sim30-…@orvok.test) e pelos hashes que já estão
// no banco: o hash dos aparelhos usa um segredo do servidor que a limpeza não precisa conhecer.
import type { Pool } from "pg";

export type ResultadoLimpeza = { apagado: Record<string, number>; pendencias: string[]; diferencas: { tabela: string; antes: number; depois: number }[]; residuos: string[] };

export async function limpar(db: Pool, antes: Record<string, number>, inicioMs: number): Promise<ResultadoLimpeza> {
  const apagado: Record<string, number> = {}; const pendencias: string[] = [];
  const um = async (rotulo: string, sql: string, params: unknown[] = []): Promise<boolean> => {
    try { const r = await db.query(sql, params); apagado[rotulo] = (apagado[rotulo] ?? 0) + (r.rowCount ?? 0); return true; }
    catch (e) { const m = String((e as Error).message); if (!pendencias.includes(`${rotulo}: ${m}`)) pendencias.push(`${rotulo}: ${m}`); return false; }
  };
  const col = async (sql: string, params: unknown[] = []): Promise<string[]> => { try { return (await db.query(sql, params)).rows.map((r) => String(Object.values(r)[0])).filter((x) => x && x !== "null"); } catch { return []; } };

  // 1) o que identifica as coisas da simulação
  const usuarios = await col(`SELECT "userId" FROM "AuthIdentity" WHERE email LIKE 'sim30-%@orvok.test'`);
  const hashes = [...new Set([
    ...(await col(`SELECT "ownerTokenHash" FROM "GuestChallenge" WHERE "creatorName" LIKE 'SIM %'`)),
    ...(await col(`SELECT "ownerTokenHash" FROM "GuestChallengeAttempt" WHERE "predictorName" LIKE 'SIM %'`)),
    ...(await col(`SELECT "guestTokenHash" FROM "WorldRound" WHERE "guestName" LIKE 'SIM %' OR "initiatorName" LIKE 'SIM %'`)),
    ...(await col(`SELECT "tokenHash" FROM "ShelfPerson" WHERE name LIKE 'SIM %'`)),
  ])];

  const codigos = [...new Set([
    ...(await col(`SELECT code FROM "GuestChallenge" WHERE "creatorName" LIKE 'SIM %'`)),
    ...(await col(`SELECT code FROM "WorldRound" WHERE "initiatorName" LIKE 'SIM %' OR "guestName" LIKE 'SIM %'`)),
    ...(await col(`SELECT k.code FROM "Keepsake" k JOIN "ShelfPerson" p ON p.id=k."fromId" WHERE p.name LIKE 'SIM %'`)),
  ])];

  // 2) várias passadas: o que depende de outra coisa só sai depois dela
  for (let passada = 0; passada < 6; passada++) {
    pendencias.length = 0;
    const etapas: [string, string, unknown[]][] = [
      ["Estante: pessoas e tudo ligado a elas", `DELETE FROM "ShelfPerson" WHERE name LIKE 'SIM %'`, []],
      ["Mundo: rodadas, conversas e denúncias", `DELETE FROM "WorldRound" WHERE "initiatorName" LIKE 'SIM %' OR "guestName" LIKE 'SIM %'`, []],
      ["Retrato: respostas dos convites", `DELETE FROM "GuestChallengeAttempt" WHERE "predictorName" LIKE 'SIM %' OR "challengeId" IN (SELECT id FROM "GuestChallenge" WHERE "creatorName" LIKE 'SIM %')`, []],
      ["Retrato: denúncias de convites", `DELETE FROM "GuestReport" WHERE "challengeId" IN (SELECT id FROM "GuestChallenge" WHERE "creatorName" LIKE 'SIM %') OR "reporterTokenHash" = ANY($1) OR "reporterUserId" = ANY($2::uuid[])`, [hashes, usuarios]],
      ["Retrato: bloqueios", `DELETE FROM "GuestBlock" WHERE "blockerTokenHash" = ANY($1) OR "blockedOwnerTokenHash" = ANY($1) OR "blockerUserId" = ANY($2::uuid[]) OR "blockedOwnerUserId" = ANY($2::uuid[])`, [hashes, usuarios]],
      ["Retrato: traços ocultos", `DELETE FROM "HiddenTrait" WHERE "ownerTokenHash" = ANY($1) OR "claimedByUserId" = ANY($2::uuid[])`, [hashes, usuarios]],
      ["Retrato: linha do tempo", `DELETE FROM "RetratoSnapshot" WHERE "ownerTokenHash" = ANY($1) OR "claimedByUserId" = ANY($2::uuid[])`, [hashes, usuarios]],
      ["Retrato: convites", `DELETE FROM "GuestChallenge" WHERE "creatorName" LIKE 'SIM %'`, []],
      ["Medição: eventos dos convites, rodadas e lembranças da simulação", `DELETE FROM "ProductEvent" WHERE "actorHash" = ANY($1) OR code = ANY($2) OR (code IS NULL AND name LIKE 'estante\_%' AND "createdAt" >= $3)`, [hashes, codigos, new Date(inicioMs)]],
      ["Mundo: opções do evento de teste", `DELETE FROM "WorldOpportunity" WHERE "eventId" IN (SELECT id FROM "WorldEvent" WHERE title LIKE 'SIM %')`, []],
      ["Mundo: evento de teste", `DELETE FROM "WorldEvent" WHERE title LIKE 'SIM %'`, []],
    ];
    for (const [r, sql, p] of etapas) await um(r, sql, p);
    if (usuarios.length) {
      const fks = (await db.query(`SELECT conrelid::regclass::text AS tabela, a.attname AS coluna FROM pg_constraint c JOIN pg_attribute a ON a.attrelid=c.conrelid AND a.attnum = ANY(c.conkey) WHERE c.contype='f' AND c.confrelid='"User"'::regclass AND conrelid::regclass::text NOT IN ('"AuthIdentity"')`)).rows as { tabela: string; coluna: string }[];
      for (const f of fks) await um(`Conta: ${f.tabela.replace(/"/g, "")}`, `DELETE FROM ${f.tabela} WHERE "${f.coluna}" = ANY($1::uuid[])`, [usuarios]);
      await um("Conta: identidades de login", `DELETE FROM "AuthIdentity" WHERE "userId" = ANY($1::uuid[])`, [usuarios]);
      await um("Conta: usuários", `DELETE FROM "User" WHERE id = ANY($1::uuid[])`, [usuarios]);
    }
    if (!pendencias.length) break;
  }
  // 3) provas
  const depois: Record<string, number> = {};
  const tabs = (await db.query<{ t: string }>(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema='public' AND table_type='BASE TABLE' ORDER BY 1`)).rows.map((r) => r.t);
  for (const t of tabs) { try { depois[t] = Number((await db.query(`SELECT count(*) AS n FROM "${t}"`)).rows[0].n); } catch { depois[t] = -1; } }
  const diferencas = tabs.filter((t) => (antes[t] ?? 0) !== depois[t]).map((t) => ({ tabela: t, antes: antes[t] ?? 0, depois: depois[t]! }));
  const residuos: string[] = [];
  const sobras = await col(`SELECT 'usuários sim30: ' || count(*) FROM "AuthIdentity" WHERE email LIKE 'sim30-%'`);
  residuos.push(...sobras.filter((s) => !s.endsWith(": 0")));
  const rl = Number((await db.query(`SELECT count(*) AS n FROM "AuthRateLimit" WHERE "resetsAt" > $1`, [new Date(inicioMs)])).rows[0].n);
  if (rl) residuos.push(`${rl} contadores de limite de tentativas (AuthRateLimit) ainda ativos: expiram sozinhos em até 1 hora e não guardam dado de pessoa`);
  return { apagado, pendencias, diferencas, residuos };
}

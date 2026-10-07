import { createHash } from "node:crypto";
import type { Pool } from "pg";
import { DesafioService } from "./service";

/** Muda quando o desenho do card muda: os cards guardados com outra versão são refeitos na próxima leitura. */
export const VERSAO_DESIGN = "2026-10-07a";
export const versaoDoCartao = (nome: string, relacao: string): string => createHash("sha1").update(`${VERSAO_DESIGN}|${relacao}|${nome}`).digest("hex").slice(0, 12);

export type Gerador = (nome: string | null, relacao: string | null, formato: "preview" | "stories") => Promise<Buffer>;

/**
 * O card de prévia do convite, pronto. Se já foi desenhado (e é da versão atual) volta direto do banco; senão é desenhado,
 * guardado e devolvido. Convite que não existe mais devolve null. `gerar` é injetado para o teste não precisar desenhar.
 */
export async function cartaoDoConvite(pool: Pool, codigo: string, gerar: Gerador): Promise<{ png: Buffer; versao: string } | null> {
  const resumo = await new DesafioService(pool).resumoPublico(codigo).catch(() => null);
  if (!resumo) return null;
  const versao = versaoDoCartao(resumo.nome, resumo.relacao);
  const guardado = (await pool.query<{ png: Buffer; version: string }>(`SELECT png,version FROM "GuestChallengeCard" WHERE "challengeId"=$1`, [resumo.id])).rows[0];
  if (guardado && guardado.version === versao) return { png: guardado.png, versao };
  const png = await gerar(resumo.nome, resumo.relacao, "preview");
  await pool.query(
    `INSERT INTO "GuestChallengeCard"("challengeId",version,png) VALUES ($1,$2,$3) ON CONFLICT ("challengeId") DO UPDATE SET version=EXCLUDED.version,png=EXCLUDED.png,"createdAt"=clock_timestamp()`,
    [resumo.id, versao, png]);
  return { png, versao };
}

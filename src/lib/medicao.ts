import type { Pool } from "pg";

/** Passos do caminho do usuário que vale a pena contar. Sem dados pessoais. */
export const PASSOS = [
  "desafio_criado", "convite_aberto", "tentativa_concluida", "cartao_compartilhado", "convite_enviado",
  "mundo_rodada_criada", "mundo_convite_aberto", "mundo_convidado_participou", "mundo_opiniao", "mundo_revelacao_vista",
  "estante_lembranca_enviada", "estante_presente_aberto", "estante_reacao", "estante_estante_vista", "estante_pegada", "estante_vinculo",
] as const;
export type Passo = (typeof PASSOS)[number];

/** Registra um passo. Nunca derruba a ação principal se a gravação falhar. */
export async function registrarEvento(pool: Pool, nome: Passo, codigo: string | null, ator: string | null): Promise<void> {
  try {
    await pool.query(`INSERT INTO "ProductEvent"(name,code,"actorHash") VALUES ($1,$2,$3)`, [nome, codigo, ator ? ator.slice(0, 64) : null]);
  } catch { /* medição é secundária */ }
}

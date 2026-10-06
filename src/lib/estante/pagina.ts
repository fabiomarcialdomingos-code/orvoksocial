import { notFound } from "next/navigation";
import { authPool } from "@/lib/auth/session";
import { criarEstante } from "./instancia";

/** As páginas da Estante não existem enquanto o interruptor estiver desligado. */
export async function exigirEstanteAtiva(): Promise<void> {
  if (!(await criarEstante(authPool()).ativa())) notFound();
}

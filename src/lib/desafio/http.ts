import { ZodError } from "zod";
import { AuthError, requirePrincipal } from "@/lib/auth/session";

/** Leituras públicas do desafio: mesmo formato de erro das rotas de autenticação. */
export async function leituraPublica(operacao: () => Promise<Response>): Promise<Response> {
  try {
    const response = await operacao();
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : error instanceof ZodError ? 400 : 500;
    const code = error instanceof AuthError ? error.code : error instanceof ZodError ? "INVALID_INPUT" : "INTERNAL_ERROR";
    if (status >= 500) console.error(JSON.stringify({ level: "error", event: "desafio_failure", errorName: (error as Error)?.name }));
    return Response.json({ schemaVersion: "1", code, message: code }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

/** Sessão opcional: o visitante pode não ter conta ainda. */
export async function principalOpcional(request: Request): Promise<string | null> {
  try {
    return (await requirePrincipal(request)).userId;
  } catch (error) {
    if (error instanceof AuthError && error.status === 401) return null;
    throw error;
  }
}

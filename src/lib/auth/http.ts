import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { AuthError, assertMutationRequest } from "./session";

export async function authEndpoint(
  request: Request,
  operation: (body: unknown) => Promise<Response>,
): Promise<Response> {
  try {
    assertMutationRequest(request);
    const size = Number(request.headers.get("content-length") ?? 0);
    if (size > 16_384) throw new AuthError("BODY_TOO_LARGE", 413);
    if (!request.body) throw new AuthError("INVALID_INPUT", 400);
    const reader = request.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      total += part.value.byteLength;
      if (total > 16_384) {
        await reader.cancel();
        throw new AuthError("BODY_TOO_LARGE", 413);
      }
      chunks.push(part.value);
    }
    let body: unknown;
    try {
      body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
    } catch {
      throw new AuthError("INVALID_INPUT", 400);
    }
    const response = await operation(body);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    const status = error instanceof AuthError ? error.status : error instanceof ZodError || error instanceof SyntaxError ? 400 : 500;
    const code = error instanceof AuthError ? error.code : error instanceof ZodError || error instanceof SyntaxError ? "INVALID_INPUT" : "INTERNAL_ERROR";
    const requestId = randomUUID();
    if (status >= 500)
      console.error(JSON.stringify({ level: "error", event: "auth_failure", requestId }));
    return Response.json({ code, message: code, requestId, schemaVersion: "1" }, { status, headers: { "Cache-Control": "no-store" } });
  }
}

export function empty(status = 204): Response {
  return new Response(null, { status });
}

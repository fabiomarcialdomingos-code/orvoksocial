import { randomUUID } from "node:crypto";
import { ZodError } from "zod";
import { RadarInvariantError } from "../radar-consent";

export type ApiErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "RULE_VIOLATION"
  | "NOTICE_UNAVAILABLE"
  | "TEST_CATALOG_IN_DEPLOYED_ENVIRONMENT"
  | "RATE_LIMITED"
  | "PAYLOAD_TOO_LARGE"
  | "INTERNAL_ERROR";

export class OperationalApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
  ) {
    super(code);
  }
}

export function apiJson(data: Record<string, unknown>, status = 200): Response {
  return Response.json(
    { schemaVersion: "1", ...data },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

export function apiError(error: unknown): Response {
  const requestId = randomUUID();
  let status = 500;
  let code = "INTERNAL_ERROR";
  if (error instanceof OperationalApiError) {
    status = error.status;
    code = error.code;
  } else if (error instanceof ZodError || error instanceof SyntaxError) {
    status = 400;
    code = "VALIDATION_ERROR";
  } else if (error instanceof RadarInvariantError) {
    status = 422;
    code = error.code;
  } else if (error instanceof Error && "status" in error && "code" in error) {
    const candidate = error as Error & { status: unknown; code: unknown };
    if (typeof candidate.status === "number" && typeof candidate.code === "string") {
      status = candidate.status;
      code = candidate.code;
    }
  } else if (error && typeof error === "object" && "code" in error) {
    const pgCode = (error as { code?: unknown }).code;
    if (pgCode === "28000") {
      status = 401;
      code = "UNAUTHENTICATED";
    } else if (pgCode === "42501") {
      status = 403;
      code = "FORBIDDEN";
    } else if (pgCode === "23505") {
      status = 409;
      code = "CONFLICT";
    } else if (pgCode === "23503" || pgCode === "23514") {
      status = 422;
      code = "RULE_VIOLATION";
    }
  }
  if (status >= 500) {
    console.error(JSON.stringify({ level: "error", event: "api_failure", requestId }));
  }
  // Local diagnostics only: database codes and messages never leave the server
  // and are never logged outside development/test.
  if (status >= 403 && (process.env.APP_ENV === "development" || process.env.APP_ENV === "test")) {
    const detail = error as { code?: unknown; message?: unknown } | null;
    console.warn(JSON.stringify({ level: "debug", event: "api_rejection", requestId, status, code,
      cause: typeof detail?.code === "string" ? detail.code : undefined,
      message: typeof detail?.message === "string" ? detail.message.slice(0, 300) : undefined }));
  }
  return Response.json(
    { schemaVersion: "1", code, message: code, requestId },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

import { authPool } from "@/lib/auth/session";

export async function GET() {
  return Response.json({ status: "ok", service: "orvok-social" }, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function HEAD() {
  return new Response(null, { status: 200, headers: { "Cache-Control": "no-store" } });
}

// Kept as a named helper for the readiness route and operational checks.
export async function checkDatabase(): Promise<boolean> {
  try {
    await authPool().query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

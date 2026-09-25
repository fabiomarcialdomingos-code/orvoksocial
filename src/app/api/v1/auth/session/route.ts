import { requirePrincipal } from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const principal = await requirePrincipal(request);
    return Response.json(
      { schemaVersion: "1", authenticated: true, userId: principal.userId, role: principal.role },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    // Public pages probe the session with ?optional=1: a signed-out visitor is
    // an expected state there, not an error, so answer 200 instead of 401.
    const optional = new URL(request.url).searchParams.get("optional") === "1";
    return Response.json({ schemaVersion: "1", authenticated: false }, { status: optional ? 200 : 401, headers: { "Cache-Control": "no-store" } });
  }
}

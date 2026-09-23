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
    return Response.json({ schemaVersion: "1", authenticated: false }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
}

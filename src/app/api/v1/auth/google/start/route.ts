import { googleStartResponse } from "@/lib/auth/google";

export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const returnTo = new URL(request.url).searchParams.get("returnTo") ?? "/convites";
    return googleStartResponse(returnTo);
  } catch {
    return Response.json({ schemaVersion: "1", code: "GOOGLE_NOT_CONFIGURED", message: "Login Google indisponível." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

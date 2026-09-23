import { checkDatabase } from "../health/route";

export async function GET() {
  const database = await checkDatabase();
  return Response.json({ status: database ? "ready" : "not_ready", checks: { database } }, {
    status: database ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}

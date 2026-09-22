import { AuthService } from "@/lib/auth/service";
import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";

export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    await new AuthService(authPool()).requestReset(body);
    return Response.json({ schemaVersion: "1", accepted: true }, { status: 202 });
  });
}

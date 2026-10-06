import { after } from "next/server";
import { clientIp } from "@/lib/auth/ip";
import { entregarFilaDeEmail } from "@/lib/auth/mail";
import { AuthService } from "@/lib/auth/service";
import { authEndpoint } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";

export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    await new AuthService(authPool()).register(body, { ip: clientIp(request) });
    after(() => entregarFilaDeEmail(authPool()));
    return Response.json({ schemaVersion: "1", accepted: true }, { status: 202 });
  });
}

import { AuthService } from "@/lib/auth/service";
import { authEndpoint } from "@/lib/auth/http";
import { authPool, setSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    const { token, userId } = await new AuthService(authPool()).login(body);
    const response = Response.json({ schemaVersion: "1", userId });
    setSessionCookie(response, token);
    return response;
  });
}

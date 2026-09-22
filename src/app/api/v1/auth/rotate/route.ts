import { AuthService } from "@/lib/auth/service";
import { authEndpoint, empty } from "@/lib/auth/http";
import { authPool, readSessionCookie, setSessionCookie, AuthError } from "@/lib/auth/session";

export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    z.strictObject({}).parse(body);
    const token = readSessionCookie(request);
    if (!token) throw new AuthError("UNAUTHENTICATED", 401);
    const replacement = await new AuthService(authPool()).rotate(token);
    const response = empty();
    setSessionCookie(response, replacement);
    return response;
  });
}
import { z } from "zod";

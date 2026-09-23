import { z } from "zod";
import { AuthService } from "@/lib/auth/service";
import { authEndpoint, empty } from "@/lib/auth/http";
import { authPool, clearSessionCookie, readSessionCookie } from "@/lib/auth/session";

export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    z.strictObject({}).parse(body);
    const token = readSessionCookie(request);
    if (token) await new AuthService(authPool()).logout(token);
    const response = empty();
    clearSessionCookie(response);
    return response;
  });
}

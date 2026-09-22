import { AuthService } from "@/lib/auth/service";
import { authEndpoint, empty } from "@/lib/auth/http";
import { authPool } from "@/lib/auth/session";

export async function POST(request: Request) {
  return authEndpoint(request, async (body) => {
    await new AuthService(authPool()).resetPassword(body);
    return empty();
  });
}

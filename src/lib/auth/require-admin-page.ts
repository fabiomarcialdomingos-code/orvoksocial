import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requirePrincipal } from "./session";

/**
 * Server Components don't receive a Request object, so this rebuilds just
 * enough of one (the Cookie header) to reuse requirePrincipal's real session
 * check — same query, same rules as every API route, no second implementation
 * to drift out of sync. Anonymous or non-admin visitors never get the page.
 */
export async function requireAdminPage(): Promise<void> {
  const jar = await cookies();
  const cookieHeader = jar.getAll().map((c) => `${c.name}=${c.value}`).join("; ");
  const request = new Request("http://internal.local/", { headers: { cookie: cookieHeader } });
  try {
    const principal = await requirePrincipal(request);
    // Matches access-control.ts exactly: AUDIT:READ (what every admin API route
    // checks) requires role==="ADMIN" specifically — MODERATOR does not qualify,
    // so it doesn't get the page shell either.
    if (principal.role !== "ADMIN") redirect("/painel");
  } catch (error) {
    if (error && typeof error === "object" && "digest" in error) throw error; // let redirect() propagate
    redirect("/entrar?returnTo=%2Fadmin");
  }
}

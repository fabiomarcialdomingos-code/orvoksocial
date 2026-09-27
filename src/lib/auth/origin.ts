type OriginEnvironment = Readonly<Record<string, string | undefined>>;

function configuredOrigin(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    )
      return null;
    return url.origin;
  } catch {
    return null;
  }
}

/** Trust deployment configuration, never Origin/Host headers or *.vercel.app. */
export function allowedMutationOrigins(
  requestUrl: string,
  env: OriginEnvironment = process.env,
): Set<string> {
  const origins = new Set<string>();
  const configured = configuredOrigin(env.APP_ORIGIN);
  if (configured) origins.add(configured);

  // These exact domains are supplied by Vercel for this preview deployment.
  // Production continues to accept only the explicitly configured APP_ORIGIN.
  if (env.VERCEL === "1" && env.VERCEL_ENV === "preview") {
    for (const host of [env.VERCEL_URL, env.VERCEL_BRANCH_URL]) {
      if (
        host &&
        /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(host)
      ) {
        origins.add(`https://${host.toLowerCase()}`);
      }
    }
  }

  const deployed =
    env.APP_ENV === "production" ||
    env.APP_ENV === "staging" ||
    env.VERCEL === "1";
  if (!deployed && !env.APP_ORIGIN) {
    const localOrigin = configuredOrigin(new URL(requestUrl).origin);
    if (localOrigin) origins.add(localOrigin);
  }
  return origins;
}

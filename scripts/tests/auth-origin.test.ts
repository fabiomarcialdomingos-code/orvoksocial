import assert from "node:assert/strict";
import { test } from "node:test";
import { allowedMutationOrigins } from "../../src/lib/auth/origin";
import { assertMutationRequest, AuthError } from "../../src/lib/auth/session";

const production = "https://orvok.example";
const branch = "https://orvok-git-review-team.vercel.app";
const deployment = "https://orvok-build123-team.vercel.app";
const previewEnv = {
  APP_ENV: "production",
  APP_ORIGIN: production,
  VERCEL: "1",
  VERCEL_ENV: "preview",
  VERCEL_URL: new URL(deployment).host,
  VERCEL_BRANCH_URL: new URL(branch).host,
};

test("preview accepts canonical, deployment and branch origins only", () => {
  assert.deepEqual(
    [...allowedMutationOrigins(branch, previewEnv)],
    [production, deployment, branch],
  );
});
test("production does not accept preview domains", () => {
  assert.deepEqual(
    [
      ...allowedMutationOrigins(branch, {
        ...previewEnv,
        VERCEL_ENV: "production",
      }),
    ],
    [production],
  );
});
test("Vercel variables are ignored outside Vercel", () => {
  assert.deepEqual(
    [...allowedMutationOrigins(branch, { ...previewEnv, VERCEL: "0" })],
    [production],
  );
});
test("deployed environments never derive trust from a request URL", () => {
  for (const env of [
    { APP_ENV: "production" },
    { APP_ENV: "staging" },
    { VERCEL: "1" },
  ]) {
    assert.equal(
      allowedMutationOrigins("https://attacker.example", env).size,
      0,
    );
  }
});
test("development works on localhost without APP_ORIGIN", () => {
  assert.deepEqual(
    [
      ...allowedMutationOrigins("http://localhost:3000/api", {
        APP_ENV: "development",
      }),
    ],
    ["http://localhost:3000"],
  );
});
test("configuration accepts an origin with a trailing slash", () => {
  assert.deepEqual(
    [...allowedMutationOrigins(branch, { APP_ORIGIN: `${production}/` })],
    [production],
  );
});
test("malformed configured URLs fail closed", () => {
  for (const value of [
    "null",
    "*",
    "https://user:pass@orvok.example",
    `${production}/path`,
    `${production}?query=1`,
    `${production}#hash`,
    "file:///tmp/app",
  ]) {
    assert.equal(
      allowedMutationOrigins(branch, {
        APP_ENV: "production",
        APP_ORIGIN: value,
      }).size,
      0,
    );
  }
});
test("preview hostname configuration rejects wildcards, paths and lookalikes", () => {
  for (const host of [
    "*.vercel.app",
    "orvok.vercel.app.evil.example",
    "orvok.vercel.app/path",
    "user@orvok.vercel.app",
    "https://orvok.vercel.app",
    "orvok.vercel.app:443",
    "evil.example",
  ]) {
    const env = { ...previewEnv, VERCEL_URL: host, VERCEL_BRANCH_URL: host };
    assert.deepEqual([...allowedMutationOrigins(branch, env)], [production]);
  }
});
test("login/register mutation guard accepts this preview and rejects forged origins", () => {
  const keys = Object.keys(previewEnv);
  const original = Object.fromEntries(
    keys.map((key) => [key, process.env[key]]),
  );
  Object.assign(process.env, previewEnv);
  function request(
    origin: string | null,
    site = "same-origin",
    contentType = "application/json",
  ) {
    const headers = new Headers({
      "content-type": contentType,
      "sec-fetch-site": site,
    });
    if (origin !== null) headers.set("origin", origin);
    return new Request(`${branch}/api/v1/auth/login`, {
      method: "POST",
      headers,
    });
  }
  function rejects(req: Request, code: string) {
    assert.throws(
      () => assertMutationRequest(req),
      (error: unknown) => error instanceof AuthError && error.code === code,
    );
  }
  try {
    assert.doesNotThrow(() => assertMutationRequest(request(branch)));
    assert.doesNotThrow(() => assertMutationRequest(request(deployment)));
    assert.doesNotThrow(() => assertMutationRequest(request(production)));
    for (const origin of [
      null,
      "null",
      "https://other-project.vercel.app",
      `${branch}.evil.example`,
      branch.replace("https:", "http:"),
    ]) {
      rejects(request(origin), "ORIGIN_REJECTED");
    }
    rejects(request(branch, "cross-site"), "CROSS_SITE_REJECTED");
    rejects(request(branch, "same-site"), "CROSS_SITE_REJECTED");
    rejects(request(branch, "same-origin", "text/plain"), "JSON_REQUIRED");
    const forged = request("https://attacker.example");
    forged.headers.set("host", "attacker.example");
    forged.headers.set("x-forwarded-host", "attacker.example");
    rejects(forged, "ORIGIN_REJECTED");
    process.env.VERCEL_ENV = "production";
    rejects(request(branch), "ORIGIN_REJECTED");
    delete process.env.APP_ORIGIN;
    rejects(request(production), "ORIGIN_NOT_CONFIGURED");
  } finally {
    for (const key of keys) {
      if (original[key] === undefined) delete process.env[key];
      else process.env[key] = original[key];
    }
  }
});

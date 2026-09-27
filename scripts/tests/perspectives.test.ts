import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import { randomUUID, randomBytes } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";
import type { Pool } from "pg";
import { handlePerspectiveRoute } from "../../src/lib/api/perspective-routes";
import {
  CATALOG,
  selectQuestions,
  assess,
  SELF_NOTICE,
  SHARE_NOTICE,
  INVITE_NOTICE,
  type Connection,
  type Round,
  type Preferences,
} from "../../src/lib/perspectives/model";
process.env.APP_ENV = "test";
let count = 0;
function check(value: unknown, label: string) {
  assert.ok(value, label);
  count++;
}
async function rejects(fn: () => Promise<unknown>, label: string) {
  await assert.rejects(fn, label);
  count++;
}
const db = new PGlite({ extensions: { pgcrypto } });
await db.waitReady;
try {
  for (const name of (await readdir("prisma/migrations")).sort())
    if (name.startsWith("2026"))
      await db.exec(
        await readFile(`prisma/migrations/${name}/migration.sql`, "utf8"),
      );
  check(true, "all migrations apply to clean database");
  await db.exec(
    "GRANT USAGE ON SCHEMA public TO orvok_app_runtime; GRANT EXECUTE ON FUNCTION orvok_read_actor(),orvok_read_role(),orvok_current_actor(),orvok_social_notify(uuid,text,uuid) TO orvok_app_runtime;",
  );
  const users = ["Ana", "Fabio", "Bruno"].map((name) => ({
    id: randomUUID(),
    hash: randomBytes(32).toString("hex"),
    name,
  }));
  for (const u of users) {
    await db.query(
      'INSERT INTO "User"(id,role,"updatedAt") VALUES($1,\'USER\',clock_timestamp())',
      [u.id],
    );
    await db.query(
      'INSERT INTO "AuthIdentity"("userId",email,"passwordHash","verifiedAt") VALUES($1,$2,\'test\',clock_timestamp())',
      [u.id, `${u.name.toLowerCase()}@orvok.test`],
    );
    await db.query(
      'INSERT INTO "AuthSession"(id,"userId","tokenHash","familyId","expiresAt") VALUES($1,$2,$3,$4,clock_timestamp()+interval \'1 day\')',
      [randomUUID(), u.id, u.hash, randomUUID()],
    );
    await db.query(
      'INSERT INTO "UserProfile"("userId","displayName") VALUES($1,$2)',
      [u.id, u.name],
    );
  }
  const a = users[0]!,
    b = users[1]!,
    third = users[2]!;
  const pool = {
    query: async (sql: string, values?: unknown[]) => {
      const r = await db.query(sql, values);
      return { ...r, rowCount: r.affectedRows ?? r.rows.length };
    },
    connect: async () => ({ ...pool, release: () => undefined }),
  } as unknown as Pool;
  async function asUser(u: typeof a) {
    await db.exec("RESET ROLE");
    await db.query("SELECT set_config('orvok.session_hash',$1,false)", [
      u.hash,
    ]);
    await db.exec("SET ROLE orvok_app_runtime");
  }
  async function owner(sql: string, values: unknown[] = []) {
    await db.exec("RESET ROLE");
    return db.query(sql, values);
  }
  async function api<T>(
    u: typeof a,
    route: string,
    body?: unknown,
  ): Promise<T> {
    await asUser(u);
    const response = await handlePerspectiveRoute({
      route,
      path: route.slice(1).split("/"),
      method: body === undefined ? "GET" : "POST",
      actorId: u.id,
      sessionHash: u.hash,
      pool,
      readBody: async () => body,
      request: new Request("http://orvok.test/api/v1" + route),
    });
    assert.ok(response);
    return response.json() as Promise<T>;
  }
  async function rpc(
    u: typeof a,
    action: string,
    data: unknown,
  ): Promise<Connection> {
    await asUser(u);
    return (
      await db.query<{ r: Connection }>(
        "SELECT orvok_perspective_connections($1,$2::jsonb) AS r",
        [action, JSON.stringify(data)],
      )
    ).rows[0]!.r;
  }
  check(CATALOG.length === 100, "100 authored questions");
  check(new Set(CATALOG.map((q) => q.id)).size === 100, "unique ids");
  check(
    CATALOG.every(
      (q) =>
        q.options.length === 4 &&
        new Set(q.options.map((o) => o.id)).size === 4,
    ),
    "four unique options",
  );
  check(new Set(CATALOG.map((q) => q.topic)).size === 10, "ten topics");
  const selection = selectQuestions({
    seed: "a",
    relationship: "colega",
    interests: ["trabalho"],
  });
  check(
    selection.length === 12 && new Set(selection.map((q) => q.id)).size === 12,
    "12 unique questions",
  );
  check(selection.filter((q) => q.anchor).length === 4, "four common anchors");
  check(
    JSON.stringify(selection) ===
      JSON.stringify(
        selectQuestions({
          seed: "a",
          relationship: "colega",
          interests: ["trabalho"],
        }),
      ),
    "deterministic selection",
  );
  check(
    JSON.stringify(selection) !==
      JSON.stringify(
        selectQuestions({
          seed: "b",
          relationship: "crush",
          interests: ["afeto"],
        }),
      ),
    "personalized sets differ",
  );
  const prefs: Preferences = {
    interests: ["afeto", "interesses"],
    age: 38,
    profession: "Engenheira",
    showAge: false,
    showProfession: false,
  };
  await api(a, "/perspectives/preferences", prefs);
  check(
    (await api<{ preferences: Preferences }>(a, "/perspectives/preferences"))
      .preferences.age === 38,
    "preferences persisted",
  );
  await rejects(
    () => api(a, "/perspectives/rounds", { kind: "initial", accepted: false }),
    "self consent required",
  );
  let ar = (
    await api<{ round: Round }>(a, "/perspectives/rounds", {
      kind: "initial",
      relationship: "crush",
      accepted: true,
    })
  ).round;
  check(ar.questions.length === 12, "persisted initial round");
  check(
    (
      await api<{ round: Round }>(a, "/perspectives/rounds", {
        kind: "initial",
        relationship: "mae",
        accepted: true,
      })
    ).round.id === ar.id,
    "initial request idempotent",
  );
  const removed = ar.questions[0]!.id;
  ar = (
    await api<{ round: Round }>(a, `/perspectives/rounds/${ar.id}/skip`, {
      questionId: removed,
    })
  ).round;
  check(
    !ar.questions.some((q) => q.id === removed) && ar.skipped.includes(removed),
    "skip persisted",
  );
  await rejects(
    () =>
      api(b, `/perspectives/rounds/${ar.id}/answer`, {
        questionId: ar.questions[0]!.id,
        optionId: "A",
      }),
    "cannot answer another person",
  );
  await rejects(
    () =>
      rpc(a, "create", {
        kind: "people",
        roundId: ar.id,
        accepted: true,
        notice: SHARE_NOTICE,
      }),
    "unfinished round cannot be shared",
  );
  await rejects(
    () =>
      api(a, `/perspectives/rounds/${ar.id}/answer`, {
        questionId: ar.questions[0]!.id,
        optionId: "X",
      }),
    "unknown option rejected",
  );
  for (const q of ar.questions)
    ar = (
      await api<{ round: Round }>(a, `/perspectives/rounds/${ar.id}/answer`, {
        questionId: q.id,
        optionId: "A",
      })
    ).round;
  let c = (
    await api<{ connection: Connection }>(a, "/perspectives/connections", {
      kind: "people",
      roundId: ar.id,
      accepted: true,
    })
  ).connection;
  check(
    c.relationship === "crush" && !c.answers,
    "owner sees label without early answer payload",
  );
  await rejects(
    () =>
      api(a, `/perspectives/rounds/${ar.id}/answer`, {
        questionId: ar.questions[0]!.id,
        optionId: "B",
      }),
    "shared round immutable",
  );
  const c2 = (
    await api<{ connection: Connection }>(a, "/perspectives/connections", {
      kind: "people",
      roundId: ar.id,
      relationship: "mae",
      accepted: true,
    })
  ).connection;
  check(
    c2.code !== c.code && c2.relationship === "mae",
    "separate recipient links and labels",
  );
  const preview = await rpc(b, "read", { code: c.code });
  check(
    preview.needsAcceptance &&
      !preview.answers &&
      !preview.questions &&
      !preview.relationship,
    "preview reveals no answers or relationship",
  );
  await rejects(
    () =>
      rpc(b, "accept", {
        code: c.code,
        accepted: false,
        notice: INVITE_NOTICE,
      }),
    "explicit invite acceptance",
  );
  c = await rpc(b, "accept", {
    code: c.code,
    accepted: true,
    notice: INVITE_NOTICE,
  });
  check(
    c.questions?.length === 12 && !c.answers && !c.relationship,
    "exact target questions, no secret label",
  );
  check(
    c.questions?.map((q) => q.id).join() ===
      ar.questions.map((q) => q.id).join(),
    "guest uses inviter set",
  );
  await rejects(
    () => rpc(third, "read", { code: c.code }),
    "claimed link private",
  );
  await rejects(
    () =>
      rpc(third, "accept", {
        code: c.code,
        accepted: true,
        notice: INVITE_NOTICE,
      }),
    "one recipient only",
  );
  await asUser(b);
  await rejects(
    () => db.query('SELECT answers FROM "PerspectiveConnection"'),
    "runtime cannot directly read secrets",
  );
  check(
    (await db.query('SELECT * FROM "PerspectiveRound"')).rows.length === 0,
    "RLS protects other rounds",
  );
  const guesses = Object.fromEntries(
    ar.questions.map((q, i) => [
      q.id,
      { optionId: i < 8 ? "A" : "B", confidence: 0.65 },
    ]),
  );
  await rejects(
    () => rpc(b, "submit", { code: c.code, guesses: {} }),
    "partial submit cannot reveal",
  );
  await rejects(
    () =>
      rpc(b, "submit", {
        code: c.code,
        guesses: Object.fromEntries(
          ar.questions.map((q) => [q.id, { optionId: "A" }]),
        ),
      }),
    "SQL requires numeric confidence",
  );
  c = await rpc(b, "submit", { code: c.code, guesses });
  check(
    c.state === "completed" && !!c.answers,
    "answers reveal on completed submission",
  );
  check(
    assess(c.questions!, c.answers!, c.guesses!).hits === 8,
    "immutable comparison 8 of 12",
  );
  c = await rpc(b, "submit", { code: c.code, guesses: {} });
  check(
    assess(c.questions!, c.answers!, c.guesses!).hits === 8,
    "retry cannot replace guesses",
  );
  await rpc(a, "message", {
    code: c.code,
    body: "O que fez você pensar nisso?",
  });
  c = await rpc(b, "read", { code: c.code });
  check(c.messages?.length === 1, "private conversation after result");
  await rpc(b, "revoke", { code: c.code });
  c = await rpc(a, "read", { code: c.code });
  check(
    c.state === "revoked" && !c.answers && !c.messages,
    "revocation hides result and conversation",
  );
  await rpc(b, "accept", {
    code: c2.code,
    accepted: true,
    notice: INVITE_NOTICE,
  });
  const repeated = await rpc(b, "submit", { code: c2.code, guesses });
  check(
    assess(repeated.questions!, repeated.answers!, repeated.guesses!).total ===
      0,
    "prior revelations excluded even after revocation",
  );
  await owner(
    'INSERT INTO "SocialBlock"("blockerId","blockedId") VALUES($1,$2)',
    [b.id, a.id],
  );
  await rejects(
    () => rpc(a, "message", { code: c2.code, body: "blocked" }),
    "blocked owner cannot send",
  );
  await owner(
    'DELETE FROM "SocialBlock" WHERE "blockerId"=$1 AND "blockedId"=$2',
    [b.id, a.id],
  );
  const daily = (
    await api<{ round: Round }>(a, "/perspectives/rounds", {
      kind: "daily",
      relationship: "geral",
      accepted: true,
    })
  ).round;
  check(
    daily.questions.length === 3 &&
      !daily.questions.some(
        (q) => ar.questions.some((x) => x.id === q.id) || q.id === removed,
      ),
    "daily avoids prior selected and skipped",
  );
  check(
    (
      await api<{ round: Round }>(a, "/perspectives/rounds", {
        kind: "daily",
        relationship: "geral",
        accepted: true,
      })
    ).round.id === daily.id,
    "one daily round per Sao Paulo date",
  );
  const privateProfile = (
    await api<{
      profile: {
        age: number | null;
        profession: string | null;
        interests?: unknown;
      };
    }>(b, `/perspectives/profiles/${a.id}`)
  ).profile;
  check(
    privateProfile.age === null &&
      privateProfile.profession === null &&
      !privateProfile.interests,
    "optional fields and interests private",
  );
  await api(a, "/perspectives/preferences", {
    ...prefs,
    showAge: true,
    showProfession: true,
  });
  check(
    (
      await api<{ profile: { age: number } }>(
        b,
        `/perspectives/profiles/${a.id}`,
      )
    ).profile.age === 38,
    "opted-in age public",
  );
  const eid = randomUUID(),
    cid = randomUUID(),
    yes = randomUUID(),
    no = randomUUID();
  await owner(
    "INSERT INTO \"WorldCategory\"(id,slug,name) VALUES($1,'teste','Teste')",
    [cid],
  );
  await owner(
    'INSERT INTO "WorldEvent"(id,"categoryId",title,"resolutionCriteria","opensAt","closesAt","createdById") VALUES($1,$2,\'Evento de teste\',\'Critério de teste\',clock_timestamp()-interval \'1 day\',clock_timestamp()+interval \'2 days\',$3)',
    [eid, cid, a.id],
  );
  for (const [id, label, pos] of [
    [yes, "Sim", 0],
    [no, "Não", 1],
  ])
    await owner(
      'INSERT INTO "WorldOpportunity"(id,"eventId",code,label,position) VALUES($1,$2,$3,$3,$4)',
      [id, eid, label, pos],
    );
  async function world(u: typeof a, option: string, confidence = 0.7) {
    await owner(
      'INSERT INTO "WorldPrediction"(id,"eventId","opportunityId","predictorId",confidence,"confirmedAt","predictedAt","snapshotHash") VALUES($1,$2,$3,$4,$5,clock_timestamp(),clock_timestamp()-interval \'1 second\',$6)',
      [randomUUID(), eid, option, u.id, confidence, "a".repeat(64)],
    );
  }
  await rejects(
    () =>
      rpc(a, "create", {
        kind: "world",
        eventId: eid,
        accepted: true,
        notice: SHARE_NOTICE,
      }),
    "world invite requires own prediction",
  );
  await world(a, no);
  let wc = await rpc(a, "create", {
    kind: "world",
    eventId: eid,
    relationship: "crush",
    accepted: true,
    notice: SHARE_NOTICE,
  });
  wc = await rpc(b, "accept", {
    code: wc.code,
    accepted: true,
    notice: INVITE_NOTICE,
  });
  check(
    !wc.answers && !wc.relationship && wc.worldOptions?.length === 2,
    "world alternatives without answer or label",
  );
  await rejects(
    () =>
      rpc(b, "submit", {
        code: wc.code,
        guesses: { world: { optionId: no, confidence: 0.6 } },
      }),
    "guest must predict world before reveal",
  );
  await world(b, yes);
  await rejects(
    () =>
      rpc(b, "submit", { code: wc.code, guesses: { world: { optionId: no } } }),
    "world confidence required in SQL",
  );
  wc = await rpc(b, "submit", {
    code: wc.code,
    guesses: { world: { optionId: no, confidence: 0.6 } },
  });
  check(
    wc.answers?.world === no &&
      wc.guesses?.world?.optionId === no &&
      wc.ownWorldChoice === yes,
    "understanding despite disagreement",
  );
  await rejects(() => world(b, no), "guest cannot revise after revelation");
  await rejects(() => world(a, yes), "owner cannot revise after revelation");
  await rpc(a, "revoke", { code: wc.code });
  await rejects(() => world(b, no), "revocation does not erase exposure");
  const frozen = (
    await owner(
      'SELECT questions,"consentText" FROM "PerspectiveRound" WHERE id=$1',
      [ar.id],
    )
  ).rows[0] as { questions: unknown; consentText: string };
  check(
    frozen.consentText === SELF_NOTICE &&
      JSON.stringify(frozen.questions) === JSON.stringify(ar.questions),
    "snapshot and exact consent persisted",
  );
  await owner(
    'INSERT INTO "PerspectiveConnection"(code,"ownerId",kind,relationship,title,"roundId",questions,answers,"consentVersion","shareNotice") SELECT replace(gen_random_uuid()::text,\'-\',\'\'),"ownerId",kind,relationship,title,"roundId",questions,answers,"consentVersion","shareNotice" FROM "PerspectiveConnection",generate_series(1,105) WHERE id=$1',
    [c2.id],
  );
  await asUser(a);
  const page = (
    await db.query<{ r: { items: Connection[] } }>(
      "SELECT orvok_perspective_connections('export',jsonb_build_object('cursor','00000000-0000-0000-0000-000000000000')) AS r",
    )
  ).rows[0]!.r.items;
  check(page.length === 100, "first export page");
  const tail = (
    await db.query<{ r: { items: Connection[] } }>(
      "SELECT orvok_perspective_connections('export',jsonb_build_object('cursor',$1::text)) AS r",
      [page.at(-1)!.id],
    )
  ).rows[0]!.r.items;
  check(tail.length >= 5, "export reaches older connections beyond UI limit");
  process.env.APP_ENV = "production";
  await rejects(
    () => api(a, "/perspectives/rounds"),
    "candidate instrument gated",
  );
  process.env.APP_ENV = "test";
  // Optional local browser harness receives the real API/SQL fixture; never production credentials.
  if (process.env.ORVOK_BROWSER_HARNESS) {
    const { runBrowser } = await import(process.env.ORVOK_BROWSER_HARNESS);
    await runBrowser({ api, owner, world, users, eid, yes, no });
  }
  console.log(
    `PASS: ${count} assertions — migrations, personalization, RLS, consent, private relationships, immutable comparisons, revocation, exports and world independence.`,
  );
} finally {
  await db.close();
}

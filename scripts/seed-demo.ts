import "dotenv/config";
import { createHash, randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { Pool } from "pg";
import { hashPassword } from "../src/lib/auth/crypto";

/**
 * Local/test seed. Enables the TEST_ONLY Radar catalog, imports the demo
 * question set, creates the administrator account used by the simulation and
 * approves TEST consent notices. Refuses to run outside *_dev / *_test
 * databases or in staging/production.
 */
const url = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DB_OWNER_URL_REQUIRED");
const database = decodeURIComponent(new URL(url).pathname.slice(1));
if (!/(_dev|_test)$/.test(database) || ["staging", "production"].includes(process.env.APP_ENV ?? ""))
  throw new Error("SEED_REQUIRES_LOCAL_TEST_DATABASE");

const adminEmail = (process.env.SEED_ADMIN_EMAIL ?? "admin@orvok.test").toLowerCase();
const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Orvok#Admin2026";

const notices = {
  SELF_ANSWER: [
    "Aviso de teste (ambiente local).",
    "Suas respostas sobre você ficam guardadas como versões imutáveis e só servem de gabarito para comparar com previsões que você autorizar.",
    "Você pode revogar este consentimento a qualquer momento em Privacidade e dados.",
  ].join("\n\n"),
  BE_PREDICTED: [
    "Aviso de teste (ambiente local).",
    "Ao consentir, a pessoa que enviou o pedido poderá registrar previsões sobre as suas respostas.",
    "Cada previsão guarda a versão deste aviso. Se você revogar, as previsões deixam de ser visíveis para você e para ela.",
  ].join("\n\n"),
} as const;

execSync(
  "corepack pnpm exec tsx scripts/import-radar-catalog.ts prisma/fixtures/radar-demo-catalog.json",
  { stdio: "inherit", env: { ...process.env, ORVOK_ALLOW_TEST_SEED: "1" } },
);

const pool = new Pool({ connectionString: url });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query(`UPDATE "RadarCatalogControl" SET "allowTestOnly"=true,"updatedAt"=clock_timestamp() WHERE id=1`);

  let adminId = (await client.query<{ userId: string }>(`SELECT "userId" FROM "AuthIdentity" WHERE email=$1`, [adminEmail])).rows[0]?.userId;
  if (!adminId) {
    adminId = randomUUID();
    await client.query(`INSERT INTO "User" (id,role,"updatedAt") VALUES ($1,'ADMIN',clock_timestamp())`, [adminId]);
    await client.query(
      `INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES ($1,$2,$3,clock_timestamp())`,
      [adminId, adminEmail, await hashPassword(adminPassword)],
    );
  } else {
    await client.query(`UPDATE "User" SET role='ADMIN',status='ACTIVE',"updatedAt"=clock_timestamp() WHERE id=$1`, [adminId]);
  }
  await client.query(
    `INSERT INTO "UserProfile" ("userId","displayName",bio) VALUES ($1,'Equipe ORVOK','Conta administrativa do ambiente local.')
     ON CONFLICT ("userId") DO NOTHING`,
    [adminId],
  );

  for (const [purpose, content] of Object.entries(notices)) {
    const hash = createHash("sha256").update(content, "utf8").digest("hex");
    await client.query(
      `INSERT INTO "ConsentNotice" (id,purpose,version,content,"contentHash",status,"testOnly","approvedAt","approvedById")
       VALUES ($1,$2::"ConsentPurpose",'TEST-2026-09',$3,$4,'APPROVED',true,clock_timestamp(),$5)
       ON CONFLICT (purpose,version) DO NOTHING`,
      [randomUUID(), purpose, content, hash, adminId],
    );
  }
  await client.query("COMMIT");
  console.info(`Seed ready: TEST catalog enabled, notices approved, admin ${adminEmail}`);
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}

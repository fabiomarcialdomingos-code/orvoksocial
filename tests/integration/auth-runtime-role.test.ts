import "dotenv/config";
import { randomBytes, randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { Pool } from "pg";
import { AuthService } from "../../src/lib/auth/service";
import { authPool } from "../../src/lib/auth/session";

const ownerUrl = process.env.DATABASE_URL;
const restrictedUrl = process.env.AUTH_DATABASE_URL;

describe.skipIf(!ownerUrl || !restrictedUrl)("papel restrito de autenticação", () => {
  const owner = new Pool({ connectionString: ownerUrl });
  const service = new AuthService(authPool());
  const email = `restricted-${randomUUID()}@example.test`;
  const password = "Senha de ensaio suficientemente longa 123!";
  let userId: string | undefined;

  beforeAll(() => {
    process.env.AUTH_SECRET = randomBytes(32).toString("hex");
    process.env.AUTH_MAIL_KEY = randomBytes(32).toString("hex");
  });

  afterAll(async () => {
    if (userId) {
      await owner.query(`DELETE FROM "AuditLog" WHERE "actorId"=$1`, [userId]);
      await owner.query(`DELETE FROM "AuthMailOutbox" WHERE "userId"=$1`, [userId]);
      await owner.query(`DELETE FROM "AuthToken" WHERE "userId"=$1`, [userId]);
      await owner.query(`DELETE FROM "AuthSession" WHERE "userId"=$1`, [userId]);
      await owner.query(`DELETE FROM "AuthIdentity" WHERE "userId"=$1`, [userId]);
      await owner.query(`DELETE FROM "User" WHERE id=$1`, [userId]);
    }
    await owner.end();
  });

  it("cadastra pelo papel auth sem poder criar administrador", async () => {
    await service.register({ email, password });
    const found = await owner.query<{ id: string; role: string }>(
      `SELECT u.id,u.role FROM "User" u JOIN "AuthIdentity" ai ON ai."userId"=u.id WHERE ai.email=$1`, [email],
    );
    userId = found.rows[0]?.id;
    expect(userId).toBeTruthy();
    expect(found.rows[0]?.role).toBe("USER");
    await expect(authPool().query(`UPDATE "User" SET role='ADMIN' WHERE id=$1`, [userId]))
      .rejects.toMatchObject({ code: "42501" });
  });
});

import { randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
import { z } from "zod";
import {
  encryptMailPayload,
  hashPassword,
  randomToken,
  tokenHash,
  verifyPassword,
} from "./crypto";
import { AuthError } from "./session";

const emailSchema = z.email().max(320).transform((email) => email.trim().toLowerCase());
export const PASSWORD_POLICY_MESSAGE = "A senha deve conter no mínimo 8 caracteres, incluindo uma letra minúscula, uma letra maiúscula e um caractere especial.";
const passwordSchema = z.string().min(8, PASSWORD_POLICY_MESSAGE).max(1024).regex(/[a-z]/, PASSWORD_POLICY_MESSAGE).regex(/[A-Z]/, PASSWORD_POLICY_MESSAGE).regex(/[^A-Za-z0-9]/, PASSWORD_POLICY_MESSAGE);
const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
const DUMMY_HASH = "scrypt-v1$fixed-dummy-salt$Uk-txZBBzDoIbfIppKjaPBY-hZwxQfJ0TM7UAQmhe1yM5nAry6tPkqjgA4VZkG1w3oH2n9UJY2HiDD9TmrUg2g";
const SESSION_SECONDS = 7 * 24 * 60 * 60;

export const registrationSchema = z.strictObject({ email: emailSchema, password: passwordSchema });
export const loginSchema = registrationSchema;
export const emailRequestSchema = z.strictObject({ email: emailSchema });
export const tokenRequestSchema = z.strictObject({ token: tokenSchema });
export const resetSchema = z.strictObject({ token: tokenSchema, password: passwordSchema });
export const changePasswordSchema = z.strictObject({ currentPassword: z.string().min(1).max(1024), password: passwordSchema });

export type AuthMailPayload = {
  email: string;
  purpose: "VERIFY_EMAIL" | "RESET_PASSWORD";
  token: string;
};

export type GoogleIdentityClaims = { subject: string; email: string; emailVerified: boolean };

export class AuthService {
  constructor(private readonly pool: Pool) {}

  private async tx<T>(work: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const value = await work(client);
      await client.query("COMMIT");
      return value;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  private async audit(client: PoolClient, actorId: string | null, action: string): Promise<void> {
    await client.query(
      `INSERT INTO "AuditLog" (id,"actorId",action,"objectType","objectId","occurredAt") VALUES ($1,$2,$3,'AuthIdentity',$4,clock_timestamp())`,
      [randomUUID(), actorId, action, actorId ?? randomUUID()],
    );
  }

  private async limit(key: string, max: number, seconds: number): Promise<void> {
    const hash = tokenHash(`rate:${key}`);
    const result = await this.pool.query<{ attempts: number }>(
      `INSERT INTO "AuthRateLimit" ("keyHash",attempts,"resetsAt") VALUES ($1,1,clock_timestamp()+($2::int * interval '1 second'))
       ON CONFLICT ("keyHash") DO UPDATE SET
         attempts=CASE WHEN "AuthRateLimit"."resetsAt" <= clock_timestamp() THEN 1 ELSE "AuthRateLimit".attempts+1 END,
         "resetsAt"=CASE WHEN "AuthRateLimit"."resetsAt" <= clock_timestamp() THEN clock_timestamp()+($2::int * interval '1 second') ELSE "AuthRateLimit"."resetsAt" END
       RETURNING attempts`,
      [hash, seconds],
    );
    if ((result.rows[0]?.attempts ?? max + 1) > max) throw new AuthError("RATE_LIMITED", 429);
  }

  private async queueMail(
    client: PoolClient,
    userId: string,
    email: string,
    purpose: AuthMailPayload["purpose"],
    ttlMinutes: number,
  ): Promise<void> {
    const token = randomToken();
    await client.query(
      `INSERT INTO "AuthToken" (id,"userId",purpose,"tokenHash","expiresAt") VALUES ($1,$2,$3,$4,clock_timestamp()+($5::int * interval '1 minute'))`,
      [randomUUID(), userId, purpose, tokenHash(token), ttlMinutes],
    );
    await client.query(
      `INSERT INTO "AuthMailOutbox" (id,"userId",purpose,"encryptedPayload") VALUES ($1,$2,$3,$4)`,
      [randomUUID(), userId, purpose, encryptMailPayload({ email, purpose, token } satisfies AuthMailPayload)],
    );
  }

  private async createSession(client: PoolClient, userId: string): Promise<string> {
    const token = randomToken();
    await client.query(
      `INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES ($1,$2,$3,$4,clock_timestamp()+($5::int * interval '1 second'))`,
      [randomUUID(), userId, tokenHash(token), randomUUID(), SESSION_SECONDS],
    );
    return token;
  }

  async register(raw: unknown): Promise<void> {
    const { email, password } = registrationSchema.parse(raw);
    await this.limit("register:global", 100, 3600);
    await this.limit(`register:${email}`, 5, 3600);
    const passwordHash = await hashPassword(password);
    await this.tx(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`auth-register:${email}`]);
      const existing = await client.query<{ userId: string; verifiedAt: Date | null }>(
        `SELECT "userId","verifiedAt" FROM "AuthIdentity" WHERE email=$1`, [email],
      );
      if (existing.rows[0]) {
        // Keep the public response identical for known and unknown addresses.
        await this.audit(client, existing.rows[0].userId, "AUTH_REGISTER_DUPLICATE");
        return;
      }
      const userId = randomUUID();
      await client.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp())`, [userId]);
      await client.query(
        `INSERT INTO "AuthIdentity" ("userId",email,"passwordHash") VALUES ($1,$2,$3)`,
        [userId, email, passwordHash],
      );
      await this.queueMail(client, userId, email, "VERIFY_EMAIL", 60 * 24);
      await this.audit(client, userId, "AUTH_REGISTERED");
    });
  }

  async verifyEmail(raw: unknown): Promise<void> {
    const { token } = tokenRequestSchema.parse(raw);
    await this.limit("verify-email:global", 300, 3600);
    await this.limit(`verify-email:${tokenHash(token)}`, 5, 3600);
    await this.tx(async (client) => {
      const found = await client.query<{ id: string; userId: string }>(
        `SELECT id,"userId" FROM "AuthToken" WHERE "tokenHash"=$1 AND purpose='VERIFY_EMAIL' AND "consumedAt" IS NULL AND "expiresAt">clock_timestamp() FOR UPDATE`,
        [tokenHash(token)],
      );
      const row = found.rows[0];
      if (!row) throw new AuthError("TOKEN_INVALID", 400);
      await client.query(`UPDATE "AuthToken" SET "consumedAt"=clock_timestamp() WHERE id=$1`, [row.id]);
      await client.query(`UPDATE "AuthIdentity" SET "verifiedAt"=COALESCE("verifiedAt",clock_timestamp()) WHERE "userId"=$1`, [row.userId]);
      await this.audit(client, row.userId, "AUTH_EMAIL_VERIFIED");
    });
  }

  async login(raw: unknown): Promise<{ token: string; userId: string }> {
    const { email, password } = loginSchema.parse(raw);
    await this.limit("login:global", 1000, 15 * 60);
    await this.limit(`login:${email}`, 10, 15 * 60);
    const found = await this.pool.query<{
      userId: string; passwordHash: string; verifiedAt: Date | null; status: string;
    }>(
      `SELECT ai."userId",ai."passwordHash",ai."verifiedAt",u.status FROM "AuthIdentity" ai JOIN "User" u ON u.id=ai."userId" WHERE ai.email=$1`,
      [email],
    );
    const identity = found.rows[0];
    const valid = await verifyPassword(password, identity?.passwordHash ?? DUMMY_HASH);
    if (!identity || !valid || !identity.verifiedAt || identity.status !== "ACTIVE") {
      await this.tx((client) => this.audit(client, identity?.userId ?? null, "AUTH_LOGIN_REJECTED"));
      throw new AuthError("INVALID_CREDENTIALS", 401);
    }
    await this.tx(async (client) => {
      await this.audit(client, identity.userId, "AUTH_LOGIN_SUCCESS");
    });
    const token = await this.tx(async (client) => this.createSession(client, identity.userId));
    return { token, userId: identity.userId };
  }

  async loginWithGoogle(claims: GoogleIdentityClaims): Promise<{ token: string; userId: string; linked: boolean }> {
    const email = emailSchema.parse(claims.email);
    if (!claims.emailVerified || !claims.subject || claims.subject.length > 255) throw new AuthError("GOOGLE_EMAIL_UNVERIFIED", 401);
    await this.limit("google-login:global", 1000, 15 * 60);
    await this.limit(`google-login:${email}`, 10, 15 * 60);
    let userId = "";
    let linked = false;
    await this.tx(async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`google:${claims.subject}`]);
      const provider = await client.query<{ userId: string; email: string }>(`SELECT "userId",email FROM "AuthProviderIdentity" WHERE provider='google' AND subject=$1 FOR UPDATE`, [claims.subject]);
      if (provider.rows[0]) {
        if (provider.rows[0].email !== email) throw new AuthError("GOOGLE_EMAIL_MISMATCH", 409);
        userId = provider.rows[0].userId;
        await client.query(`UPDATE "AuthProviderIdentity" SET "lastLoginAt"=clock_timestamp() WHERE provider='google' AND subject=$1`, [claims.subject]);
      } else {
        const existing = await client.query<{ userId: string; status: string; verifiedAt: Date | null }>(`SELECT ai."userId",u.status,ai."verifiedAt" FROM "AuthIdentity" ai JOIN "User" u ON u.id=ai."userId" WHERE ai.email=$1 FOR UPDATE`, [email]);
        if (existing.rows[0]) {
          userId = existing.rows[0].userId;
          if (existing.rows[0].status !== "ACTIVE") throw new AuthError("ACCOUNT_DISABLED", 403);
          if (!existing.rows[0].verifiedAt) await client.query(`UPDATE "AuthIdentity" SET "verifiedAt"=clock_timestamp() WHERE "userId"=$1`, [userId]);
          linked = true;
        } else {
          userId = randomUUID();
          await client.query(`INSERT INTO "User" (id,"updatedAt") VALUES ($1,clock_timestamp())`, [userId]);
          await client.query(`INSERT INTO "AuthIdentity" ("userId",email,"passwordHash","verifiedAt") VALUES ($1,$2,NULL,clock_timestamp())`, [userId, email]);
        }
        await client.query(`INSERT INTO "AuthProviderIdentity" (id,"userId",provider,subject,email) VALUES ($1,$2,'google',$3,$4)`, [randomUUID(), userId, claims.subject, email]);
        await this.audit(client, userId, linked ? "AUTH_GOOGLE_LINKED" : "AUTH_GOOGLE_REGISTERED");
      }
      const status = await client.query<{ status: string }>(`SELECT status FROM "User" WHERE id=$1`, [userId]);
      if (status.rows[0]?.status !== "ACTIVE") throw new AuthError("ACCOUNT_DISABLED", 403);
      await this.audit(client, userId, "AUTH_GOOGLE_LOGIN");
    });
    const token = await this.tx(async (client) => this.createSession(client, userId));
    return { token, userId, linked };
  }

  async unlinkGoogle(userId: string): Promise<void> {
    await this.tx(async (client) => {
      const methods = await client.query<{ passwordHash: string | null; providers: string }>(`SELECT ai."passwordHash",(SELECT count(*)::text FROM "AuthProviderIdentity" WHERE "userId"=$1) AS providers FROM "AuthIdentity" ai WHERE ai."userId"=$1 FOR UPDATE`, [userId]);
      const row = methods.rows[0];
      if (!row) throw new AuthError("NOT_FOUND", 404);
      if (!row.passwordHash && Number(row.providers) <= 1) throw new AuthError("AUTH_METHOD_REQUIRED", 409);
      const removed = await client.query(`DELETE FROM "AuthProviderIdentity" WHERE "userId"=$1 AND provider='google' RETURNING id`, [userId]);
      if (removed.rowCount) await this.audit(client, userId, "AUTH_GOOGLE_UNLINKED");
    });
  }

  async logout(token: string): Promise<void> {
    tokenSchema.parse(token);
    await this.tx(async (client) => {
      const found = await client.query<{ id: string; userId: string }>(
        `UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE "tokenHash"=$1 AND "revokedAt" IS NULL RETURNING id,"userId"`,
        [tokenHash(token)],
      );
      if (found.rows[0]) await this.audit(client, found.rows[0].userId, "AUTH_LOGOUT");
    });
  }

  async rotate(token: string): Promise<string> {
    tokenSchema.parse(token);
    const replacement = randomToken();
    await this.tx(async (client) => {
      const found = await client.query<{
        id: string; userId: string; familyId: string; revokedAt: Date | null; valid: boolean;
      }>(
        `SELECT s.id,s."userId",s."familyId",s."revokedAt",(s."expiresAt">clock_timestamp() AND u.status='ACTIVE' AND ai."verifiedAt" IS NOT NULL) AS valid
         FROM "AuthSession" s JOIN "User" u ON u.id=s."userId" JOIN "AuthIdentity" ai ON ai."userId"=u.id WHERE s."tokenHash"=$1 FOR UPDATE`,
        [tokenHash(token)],
      );
      const row = found.rows[0];
      if (!row) throw new AuthError("UNAUTHENTICATED", 401);
      if (row.revokedAt) {
        await client.query(`UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE "familyId"=$1 AND "revokedAt" IS NULL`, [row.familyId]);
        await this.audit(client, row.userId, "AUTH_SESSION_REPLAY");
        return;
      }
      if (!row.valid) throw new AuthError("UNAUTHENTICATED", 401);
      const id = randomUUID();
      await client.query(
        `INSERT INTO "AuthSession" (id,"userId","tokenHash","familyId","expiresAt") VALUES ($1,$2,$3,$4,clock_timestamp()+($5::int * interval '1 second'))`,
        [id, row.userId, tokenHash(replacement), row.familyId, SESSION_SECONDS],
      );
      await client.query(`UPDATE "AuthSession" SET "revokedAt"=clock_timestamp(),"replacedById"=$2 WHERE id=$1`, [row.id, id]);
      await this.audit(client, row.userId, "AUTH_SESSION_ROTATED");
    });
    // A replay must never receive a fresh cookie, even though family revocation committed.
    const check = await this.pool.query(`SELECT 1 FROM "AuthSession" WHERE "tokenHash"=$1 AND "revokedAt" IS NULL`, [tokenHash(replacement)]);
    if (!check.rowCount) throw new AuthError("SESSION_REPLAY", 401);
    return replacement;
  }

  async requestReset(raw: unknown): Promise<void> {
    const { email } = emailRequestSchema.parse(raw);
    await this.limit("reset:global", 100, 3600);
    await this.limit(`reset:${email}`, 5, 3600);
    await this.tx(async (client) => {
      const found = await client.query<{ userId: string }>(
        `SELECT ai."userId" FROM "AuthIdentity" ai JOIN "User" u ON u.id=ai."userId" WHERE ai.email=$1 AND u.status='ACTIVE' AND ai."verifiedAt" IS NOT NULL`,
        [email],
      );
      const row = found.rows[0];
      if (!row) return;
      await this.queueMail(client, row.userId, email, "RESET_PASSWORD", 30);
      await this.audit(client, row.userId, "AUTH_RESET_REQUESTED");
    });
  }

  async resetPassword(raw: unknown): Promise<void> {
    const { token, password } = resetSchema.parse(raw);
    await this.limit("reset-password:global", 100, 3600);
    await this.limit(`reset-password:${tokenHash(token)}`, 5, 3600);
    const passwordHash = await hashPassword(password);
    await this.tx(async (client) => {
      const found = await client.query<{ id: string; userId: string }>(
        `SELECT id,"userId" FROM "AuthToken" WHERE "tokenHash"=$1 AND purpose='RESET_PASSWORD' AND "consumedAt" IS NULL AND "expiresAt">clock_timestamp() FOR UPDATE`,
        [tokenHash(token)],
      );
      const row = found.rows[0];
      if (!row) throw new AuthError("TOKEN_INVALID", 400);
      await client.query(`UPDATE "AuthToken" SET "consumedAt"=clock_timestamp() WHERE id=$1`, [row.id]);
      await client.query(`UPDATE "AuthIdentity" SET "passwordHash"=$2,"passwordChangedAt"=clock_timestamp() WHERE "userId"=$1`, [row.userId, passwordHash]);
      await client.query(`UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE "userId"=$1 AND "revokedAt" IS NULL`, [row.userId]);
      await client.query(`UPDATE "AuthToken" SET "consumedAt"=clock_timestamp() WHERE "userId"=$1 AND purpose='RESET_PASSWORD' AND "consumedAt" IS NULL`, [row.userId]);
      await this.audit(client, row.userId, "AUTH_PASSWORD_RESET");
    });
  }

  async changePassword(userId: string, raw: unknown): Promise<void> {
    const { currentPassword, password } = changePasswordSchema.parse(raw);
    await this.limit(`change-password:${userId}`, 5, 3600);
    const found = await this.pool.query<{ passwordHash: string | null }>(`SELECT "passwordHash" FROM "AuthIdentity" WHERE "userId"=$1`, [userId]);
    if (!found.rows[0]?.passwordHash || !(await verifyPassword(currentPassword, found.rows[0].passwordHash))) throw new AuthError("INVALID_CREDENTIALS", 401);
    const passwordHash = await hashPassword(password);
    await this.tx(async (client) => {
      await client.query(`UPDATE "AuthIdentity" SET "passwordHash"=$2,"passwordChangedAt"=clock_timestamp() WHERE "userId"=$1`, [userId, passwordHash]);
      await client.query(`UPDATE "AuthSession" SET "revokedAt"=clock_timestamp() WHERE "userId"=$1 AND "revokedAt" IS NULL`, [userId]);
      await this.audit(client, userId, "AUTH_PASSWORD_CHANGED");
    });
  }
}

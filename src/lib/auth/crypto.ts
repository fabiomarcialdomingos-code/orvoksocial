import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1, maxmem: 32 * 1024 * 1024 };

function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, SCRYPT_PARAMS, (error, result) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

export function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenHash(value: string): string {
  const key = process.env.AUTH_SECRET;
  if (!key || key.length < 32) throw new Error("AUTH_SECRET is required");
  return createHmac("sha256", key).update(value).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("base64url");
  const derived = await derive(password, salt);
  return `scrypt-v1$${salt}$${derived.toString("base64url")}`;
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  const [version, salt, stored] = encoded.split("$");
  if (version !== "scrypt-v1" || !salt || !stored) return false;
  const expected = Buffer.from(stored, "base64url");
  if (expected.length !== 64) return false;
  const actual = await derive(password, salt);
  return timingSafeEqual(actual, expected);
}

function encryptionKey(): Buffer {
  const raw = process.env.AUTH_MAIL_KEY;
  if (!raw || !/^[a-f0-9]{64}$/i.test(raw))
    throw new Error("AUTH_MAIL_KEY must be a 32-byte hex key");
  return Buffer.from(raw, "hex");
}

export function encryptMailPayload(payload: unknown): string {
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), nonce);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(payload), "utf8"),
    cipher.final(),
  ]);
  return [nonce, cipher.getAuthTag(), ciphertext]
    .map((part) => part.toString("base64url"))
    .join(".");
}

export function decryptMailPayload<T>(payload: string): T {
  const [nonce, tag, ciphertext] = payload.split(".");
  if (!nonce || !tag || !ciphertext) throw new Error("Malformed mail payload");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(nonce, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  return JSON.parse(plaintext) as T;
}

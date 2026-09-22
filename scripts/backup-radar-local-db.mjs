import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

const ownerUrl = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!ownerUrl) throw new Error("DATABASE_URL_REQUIRED");
const source = new URL(ownerUrl);
if (decodeURIComponent(source.pathname.slice(1)) !== "orvok_dev") throw new Error("REFUSE_NON_LOCAL_DATABASE");
const folder = await mkdtemp(join(tmpdir(), "orvok-radar-before-rebuild-"));
const archive = join(folder, "orvok_dev.dump");
const command = process.platform === "win32" ? "C:\\Program Files\\PostgreSQL\\18\\bin\\pg_dump.exe" : "pg_dump";
const result = spawnSync(command, ["--format=custom", "--file", archive, "--no-owner", "--no-acl"], {
  env: { ...process.env, PGHOST: source.hostname, PGPORT: source.port || "5432",
    PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password),
    PGDATABASE: "orvok_dev" }, encoding: "utf8",
});
if (result.status !== 0) throw new Error(`BACKUP_FAILED ${result.status}: ${result.stderr}`);
const bytes = await readFile(archive);
if (bytes.subarray(0, 5).toString() !== "PGDMP") throw new Error("BACKUP_HEADER_INVALID");
console.log(JSON.stringify({ archive, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex") }));

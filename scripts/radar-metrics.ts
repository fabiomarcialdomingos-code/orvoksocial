import "dotenv/config";
import { Pool } from "pg";

// Administrative aggregate only. Never expose this script through an HTTP route.
const url = process.env.DB_OWNER_URL ?? process.env.DATABASE_URL;
if (!url) throw new Error("DB_OWNER_URL_REQUIRED");
const hours = Number(process.argv[2] ?? "24");
if (!Number.isInteger(hours) || hours < 1 || hours > 24 * 30)
  throw new Error("WINDOW_HOURS_MUST_BE_1_TO_720");

const pool = new Pool({ connectionString: url });
try {
  const events = await pool.query<{ action: string; count: number }>(
    `SELECT action, COUNT(*)::integer AS count FROM "AuditLog"
     WHERE "occurredAt" >= clock_timestamp() - ($1::integer * interval '1 hour')
     AND (action LIKE 'RADAR_%' OR action LIKE 'SELF_ANSWER_%')
     GROUP BY action ORDER BY action`,
    [hours],
  );
  const notifications = await pool.query<{ state: string; count: number }>(
    `SELECT state::text, COUNT(*)::integer AS count FROM "Notification"
     WHERE "createdAt" >= clock_timestamp() - ($1::integer * interval '1 hour')
     GROUP BY state ORDER BY state`,
    [hours],
  );
  console.log(JSON.stringify({
    metricVersion: "RADAR-OPS-01",
    windowHours: hours,
    auditEvents: events.rows,
    notificationStates: notifications.rows,
  }));
} finally {
  await pool.end();
}

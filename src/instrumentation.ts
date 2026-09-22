import { assertRuntimeDatabaseBoundary } from "./lib/runtime-boundary";

export function register(): void {
  if (process.env.NEXT_RUNTIME === "nodejs") assertRuntimeDatabaseBoundary();
}

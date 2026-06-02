import fs from "fs";
import path from "path";
import { sql } from "drizzle-orm";
import { db } from "./db";

/**
 * Apply all *.sql files in /migrations sequentially.
 * All migration files MUST be idempotent (use IF NOT EXISTS / DO $$ ... EXCEPTION blocks).
 *
 * Runs at startup. Safe to run multiple times — failures are logged but don't block boot.
 */
export async function runMigrations(): Promise<void> {
  const migrationsDir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) {
    console.log("[migrations] no migrations dir, skipping");
    return;
  }

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith(".sql"))
    .sort();

  if (files.length === 0) {
    console.log("[migrations] no .sql files found");
    return;
  }

  console.log(`[migrations] applying ${files.length} migration(s)...`);

  for (const file of files) {
    const filePath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(filePath, "utf-8");
    try {
      await db.execute(sql.raw(sqlContent));
      console.log(`[migrations] ✓ ${file}`);
    } catch (err: any) {
      console.error(`[migrations] ✗ ${file}: ${err.message}`);
    }
  }
}

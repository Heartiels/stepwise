import { db } from "./client";
import { initDb } from "./schema";

let initialized = false;

export function ensureDb() {
  if (initialized) return;
  initDb();
  // Migration: add xp column if not yet present
  try {
    db.execSync(`ALTER TABLE subtasks ADD COLUMN xp INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — safe to ignore
  }
  initialized = true;
}

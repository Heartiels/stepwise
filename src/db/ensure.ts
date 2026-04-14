import { db } from "./client";
import { initDb } from "./schema";
import { formatStoredStepContent, readStepContent } from "../tasks/stepContent";

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
  try {
    db.execSync(`ALTER TABLE subtasks ADD COLUMN emoji TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    db.execSync(`ALTER TABLE subtasks ADD COLUMN action TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    db.execSync(`ALTER TABLE subtasks ADD COLUMN explanation TEXT NOT NULL DEFAULT ''`);
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    db.execSync(`ALTER TABLE subtasks ADD COLUMN focus_seconds INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — safe to ignore
  }
  try {
    db.execSync(`ALTER TABLE subtasks ADD COLUMN focus_sessions INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // Column already exists — safe to ignore
  }

  const rowsNeedingBackfill = db.getAllSync<{
    id: string;
    title: string;
    emoji: string;
    action: string;
    explanation: string;
  }>(
    `SELECT id, title, emoji, action, explanation
     FROM subtasks
     WHERE action = ''`
  );

  for (const row of rowsNeedingBackfill) {
    const content = readStepContent(row);
    db.runSync(
      `UPDATE subtasks
       SET title = ?, emoji = ?, action = ?, explanation = ?
       WHERE id = ?`,
      [
        formatStoredStepContent(content),
        content.emoji,
        content.action,
        content.explanation,
        row.id,
      ]
    );
  }
  initialized = true;
}

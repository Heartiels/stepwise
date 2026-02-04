import { db } from "./client";

export function initDb() {
  db.execSync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY NOT NULL,
      title TEXT NOT NULL,
      notes TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS subtasks (
      id TEXT PRIMARY KEY NOT NULL,
      task_id TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'todo',
      ord INTEGER NOT NULL,
      estimate_min INTEGER NOT NULL DEFAULT 10,
      completed_at INTEGER,
      is_today INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_subtasks_task_id ON subtasks(task_id);
    CREATE INDEX IF NOT EXISTS idx_subtasks_is_today ON subtasks(is_today);
  `);
}

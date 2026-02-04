import { db } from "./client";

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: "active" | "done" | "archived";
  created_at: number;
};

export function listTasks(): Task[] {
  return db.getAllSync<Task>(
    `SELECT id, title, notes, status, created_at
     FROM tasks
     WHERE status != 'archived'
     ORDER BY created_at DESC`
  );
}

export function addTask(title: string) {
  const t = title.trim();
  if (!t) return null;

  const id = crypto.randomUUID();
  const now = Date.now();

  db.runSync(
    `INSERT INTO tasks (id, title, notes, status, created_at)
     VALUES (?, ?, '', 'active', ?)`,
    [id, t, now]
  );

  return id;
}

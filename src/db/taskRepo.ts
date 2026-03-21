import { v4 as uuidv4 } from 'uuid';
import { db } from "./client";
import { ensureDb } from "./ensure";

export type Task = {
  id: string;
  title: string;
  notes: string;
  status: "active" | "done" | "archived";
  created_at: number;
};

export type Subtask = {
  id: string;
  task_id: string;
  title: string;
  status: string;
  ord: number;
  estimate_min: number;
  completed_at: number | null;
  is_today: number;
};

export function listTasks(): Task[] {
  ensureDb();
  return db.getAllSync<Task>(
    `SELECT id, title, notes, status, created_at
     FROM tasks
     WHERE status != 'archived'
     ORDER BY created_at DESC`
  );
}

export function addTask(title: string): string | null {
  const t = title.trim();
  if (!t) return null;

  const id = uuidv4();
  const now = Date.now();

  db.runSync(
    `INSERT INTO tasks (id, title, notes, status, created_at)
     VALUES (?, ?, '', 'active', ?)`,
    [id, t, now]
  );

  return id;
}

export function updateTaskNotes(taskId: string, notes: string) {
  db.runSync(`UPDATE tasks SET notes = ? WHERE id = ?`, [notes, taskId]);
}

export function deleteTask(taskId: string) {
  // Subtasks are deleted automatically via ON DELETE CASCADE
  db.runSync(`DELETE FROM tasks WHERE id = ?`, [taskId]);
}

export function addSubtasks(
  taskId: string,
  steps: { title: string; ord: number }[]
) {
  for (const step of steps) {
    const id = uuidv4();
    db.runSync(
      `INSERT INTO subtasks (id, task_id, title, status, ord, estimate_min, is_today)
       VALUES (?, ?, ?, 'todo', ?, 10, 0)`,
      [id, taskId, step.title, step.ord]
    );
  }
}

export function updateSubtaskStatus(subtaskId: string, status: "todo" | "done") {
  db.runSync(
    `UPDATE subtasks SET status = ?, completed_at = ? WHERE id = ?`,
    [status, status === "done" ? Date.now() : null, subtaskId]
  );
}

export function getUserSetting(key: string, fallback = ""): string {
  ensureDb();
  const row = db.getFirstSync<{ value: string }>(
    `SELECT value FROM settings WHERE key = ?`, [key]
  );
  return row?.value ?? fallback;
}

export function setUserSetting(key: string, value: string) {
  db.runSync(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export function getUserNickname(): string {
  return getUserSetting("nickname", "My Name");
}

export function setUserNickname(name: string) {
  setUserSetting("nickname", name);
}

export function getCompletionsByDay(): Record<string, number> {
  ensureDb();
  const rows = db.getAllSync<{ day: string; count: number }>(
    `SELECT date(completed_at / 1000, 'unixepoch', 'localtime') as day, COUNT(*) as count
     FROM subtasks WHERE status = 'done' AND completed_at IS NOT NULL
     GROUP BY day`
  );
  const map: Record<string, number> = {};
  rows.forEach((r) => { map[r.day] = r.count; });
  return map;
}

export function replaceSubtasks(
  taskId: string,
  steps: { title: string; ord: number; status?: string; completed_at?: number | null }[]
) {
  db.runSync(`DELETE FROM subtasks WHERE task_id = ?`, [taskId]);
  for (const step of steps) {
    const id = uuidv4();
    db.runSync(
      `INSERT INTO subtasks (id, task_id, title, status, ord, estimate_min, is_today, completed_at)
       VALUES (?, ?, ?, ?, ?, 10, 0, ?)`,
      [id, taskId, step.title, step.status ?? "todo", step.ord, step.completed_at ?? null]
    );
  }
}

export function listSubtasksForTask(taskId: string): Subtask[] {
  ensureDb();
  return db.getAllSync<Subtask>(
    `SELECT id, task_id, title, status, ord, estimate_min, completed_at, is_today
     FROM subtasks
     WHERE task_id = ?
     ORDER BY ord ASC`,
    [taskId]
  );
}

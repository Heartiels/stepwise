import { initDb } from "./schema";

let initialized = false;

export function ensureDb() {
  if (initialized) return;
  initDb();
  initialized = true;
}

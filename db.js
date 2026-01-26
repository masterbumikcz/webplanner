import sqlite3 from "sqlite3";
import { open } from "sqlite";
const dbName = "webplanner.db";

const db = await open({
  filename: dbName,
  driver: sqlite3.Database,
});

// Povolení cizích klíčů (jsou potřebné pro ON DELETE CASCADE, který slouží k mazání souvisejících záznamů)
await db.exec(`PRAGMA foreign_keys = ON;`);

// Vytvoření tabulek, pokud neexistují
await db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  );
  
  CREATE TABLE IF NOT EXISTS task_lists (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    UNIQUE(user_id, title),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );
     
  CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, 
    user_id INTEGER NOT NULL,
    tasklist_id INTEGER,
    title TEXT NOT NULL,
    is_completed BOOLEAN DEFAULT 0,
    due TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (tasklist_id) REFERENCES task_lists(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    task_id INTEGER NOT NULL,
    notify_at TEXT NOT NULL,
    sent_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
  );
`);

export default db;

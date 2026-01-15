const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function initDb({ dbFilePath, lunches }) {
  ensureDir(path.dirname(dbFilePath));
  const db = new Database(dbFilePath);

  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS lunches (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      location TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lunch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      team TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lunch_id) REFERENCES lunches(id) ON DELETE CASCADE,
      UNIQUE (lunch_id, email)
    );
  `);

  const upsertLunch = db.prepare(
    `INSERT INTO lunches (id, title, starts_at, location)
     VALUES (@id, @title, @starts_at, @location)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       starts_at=excluded.starts_at,
       location=excluded.location`
  );

  const tx = db.transaction(() => {
    for (const lunch of lunches) upsertLunch.run(lunch);
  });
  tx();

  return db;
}

module.exports = { initDb };

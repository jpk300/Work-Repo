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
  db.pragma('foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS lunches (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      starts_at TEXT NOT NULL,
      location TEXT NOT NULL,
      address TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS signups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lunch_id TEXT NOT NULL,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      team TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'confirmed',
      cancelled_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (lunch_id) REFERENCES lunches(id) ON DELETE CASCADE,
      UNIQUE (lunch_id, email)
    );
  `);

  const lunchColumns = db.prepare(`PRAGMA table_info(lunches)`).all();
  const hasAddress = lunchColumns.some((c) => c && c.name === 'address');
  if (!hasAddress) {
    db.exec(`ALTER TABLE lunches ADD COLUMN address TEXT NOT NULL DEFAULT ''`);
  }

  const signupColumns = db.prepare(`PRAGMA table_info(signups)`).all();
  const hasStatus = signupColumns.some((c) => c && c.name === 'status');
  if (!hasStatus) {
    db.exec(`ALTER TABLE signups ADD COLUMN status TEXT NOT NULL DEFAULT 'confirmed'`);
    db.exec(`UPDATE signups SET status = 'confirmed' WHERE status IS NULL OR status = ''`);
  }

  const hasCancelledAt = signupColumns.some((c) => c && c.name === 'cancelled_at');
  if (!hasCancelledAt) {
    db.exec(`ALTER TABLE signups ADD COLUMN cancelled_at TEXT`);
  }

  const upsertLunch = db.prepare(
    `INSERT INTO lunches (id, title, starts_at, location, address)
     VALUES (@id, @title, @starts_at, @location, @address)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title,
       starts_at=excluded.starts_at,
       location=excluded.location,
       address=excluded.address`
  );

  const tx = db.transaction(() => {
    for (const lunch of lunches) upsertLunch.run(lunch);
  });
  tx();

  return db;
}

module.exports = { initDb };

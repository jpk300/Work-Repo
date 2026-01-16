const path = require('path');
const express = require('express');
const { initDb } = require('./db');
const crypto = require('crypto');

const CAPACITY_PER_LUNCH = 6;

const LUNCHES = [
  {
    id: 'lunch-1',
    title: 'Lunch - St. Charles',
    starts_at: '2026-01-01T11:30:00-06:00',
    location: 'Tucanos',
    address: '1520 S 5th St, Saint Charles, MO 63303'
  },
  {
    id: 'lunch-2',
    title: 'Lunch - Illinois',
    starts_at: '2026-06-15T11:30:00-06:00',
    location: 'Peel Wood Fired Pizza',
    address: '32 S State Rte 157, Edwardsville, IL 62025'
  },
  {
    id: 'lunch-3',
    title: 'Lunch - St. Louis Area',
    starts_at: '2026-09-15T11:30:00-06:00',
    location: 'The Blue Duck',
    address: '2661 Sutton Blvd, Maplewood, MO 63143'
  }
];

const db = initDb({
  dbFilePath: path.join(__dirname, 'data', 'lunch-signups.db'),
  lunches: LUNCHES
});

const app = express();
app.use(express.json());
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function isValidEmail(email) {
  if (!isNonEmptyString(email)) return false;
  const v = email.trim();
  if (v.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function isAllowedEmailDomain(emailNormalized) {
  return typeof emailNormalized === 'string' && emailNormalized.endsWith('@wwt.com');
}

function isPastLunch(startsAtIso) {
  const t = new Date(startsAtIso).getTime();
  if (Number.isNaN(t)) return false;
  return t < Date.now();
}

function createLunchId() {
  if (typeof crypto.randomUUID === 'function') return `lunch-${crypto.randomUUID()}`;
  return `lunch-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseStartsAtOrNull(startsAt) {
  if (!isNonEmptyString(startsAt)) return null;
  const ms = new Date(startsAt).getTime();
  if (Number.isNaN(ms)) return null;
  return ms;
}

app.get('/api/lunches', (req, res) => {
  const includeDeleted = String(req.query.include_deleted || '') === '1';

  const lunches = db
    .prepare(
      `SELECT id, title, starts_at, location, address, deleted_at
       FROM lunches
       ${includeDeleted ? '' : "WHERE deleted_at IS NULL"}
       ORDER BY starts_at ASC`
    )
    .all();

  const counts = db
    .prepare(
      `SELECT lunch_id,
              SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
              SUM(CASE WHEN status = 'waitlist' THEN 1 ELSE 0 END) AS waitlist
       FROM signups
       WHERE status IN ('confirmed', 'waitlist')
       GROUP BY lunch_id`
    )
    .all();

  const countByLunchId = new Map(
    counts.map((r) => [r.lunch_id, { confirmed: r.confirmed ?? 0, waitlist: r.waitlist ?? 0 }])
  );

  res.json(
    lunches.map((l) => {
      const c = countByLunchId.get(l.id) ?? { confirmed: 0, waitlist: 0 };
      const used = c.confirmed;
      return {
        ...l,
        capacity: CAPACITY_PER_LUNCH,
        used,
        remaining: Math.max(0, CAPACITY_PER_LUNCH - used),
        waitlist: c.waitlist,
        is_past: isPastLunch(l.starts_at)
      };
    })
  );
});

app.post('/api/lunches', (req, res) => {
  const { title, starts_at, location, address } = req.body ?? {};

  if (!isNonEmptyString(title) || !isNonEmptyString(starts_at) || !isNonEmptyString(location)) {
    return res.status(400).json({ error: 'title, starts_at, and location are required' });
  }

  const startsAtMs = parseStartsAtOrNull(starts_at);
  if (startsAtMs === null) {
    return res.status(400).json({ error: 'starts_at must be a valid date/time' });
  }

  const lunch = {
    id: createLunchId(),
    title: title.trim(),
    starts_at: starts_at.trim(),
    location: location.trim(),
    address: isNonEmptyString(address) ? address.trim() : ''
  };

  try {
    db.prepare(
      `INSERT INTO lunches (id, title, starts_at, location, address)
       VALUES (?, ?, ?, ?, ?)`
    ).run(lunch.id, lunch.title, lunch.starts_at, lunch.location, lunch.address);

    return res.status(201).json({ ok: true, lunch });
  } catch {
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.delete('/api/lunches/:lunchId', (req, res) => {
  const { lunchId } = req.params;

  const existing = db
    .prepare('SELECT id, title, starts_at, location, address, deleted_at FROM lunches WHERE id = ?')
    .get(lunchId);

  if (!existing) return res.status(404).json({ error: 'Lunch not found' });

  if (existing.deleted_at) return res.json({ ok: true });

  try {
    db.prepare(`UPDATE lunches SET deleted_at = datetime('now') WHERE id = ?`).run(lunchId);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.post('/api/lunches/:lunchId/restore', (req, res) => {
  const { lunchId } = req.params;

  const existing = db
    .prepare('SELECT id FROM lunches WHERE id = ?')
    .get(lunchId);

  if (!existing) return res.status(404).json({ error: 'Lunch not found' });

  try {
    db.prepare(`UPDATE lunches SET deleted_at = NULL WHERE id = ?`).run(lunchId);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.put('/api/lunches/:lunchId', (req, res) => {
  const { lunchId } = req.params;
  const { title, starts_at, location, address } = req.body ?? {};

  if (!isNonEmptyString(title) || !isNonEmptyString(starts_at) || !isNonEmptyString(location)) {
    return res.status(400).json({ error: 'title, starts_at, and location are required' });
  }

  const startsAtMs = parseStartsAtOrNull(starts_at);
  if (startsAtMs === null) {
    return res.status(400).json({ error: 'starts_at must be a valid date/time' });
  }

  const existing = db
    .prepare('SELECT id, deleted_at FROM lunches WHERE id = ?')
    .get(lunchId);

  if (!existing) return res.status(404).json({ error: 'Lunch not found' });
  if (existing.deleted_at) return res.status(409).json({ error: 'This lunch is deleted. Restore it before editing.' });

  const updated = {
    id: lunchId,
    title: title.trim(),
    starts_at: starts_at.trim(),
    location: location.trim(),
    address: isNonEmptyString(address) ? address.trim() : ''
  };

  try {
    db.prepare(
      `UPDATE lunches
       SET title = ?, starts_at = ?, location = ?, address = ?
       WHERE id = ?`
    ).run(updated.title, updated.starts_at, updated.location, updated.address, lunchId);

    return res.json({ ok: true, lunch: updated });
  } catch {
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.get('/api/lunches/:lunchId/signups', (req, res) => {
  const { lunchId } = req.params;
  const lunch = db
    .prepare('SELECT id, title, starts_at, location, address, deleted_at FROM lunches WHERE id = ?')
    .get(lunchId);

  if (!lunch) return res.status(404).json({ error: 'Lunch not found' });

  if (lunch.deleted_at) {
    return res.status(404).json({ error: 'Lunch not found' });
  }

  const signups = db
    .prepare(
      `SELECT name, email, team, status, created_at
       FROM signups
       WHERE lunch_id = ?
       ORDER BY CASE
                  WHEN status = 'confirmed' THEN 0
                  WHEN status = 'waitlist' THEN 1
                  ELSE 2
                END,
                created_at ASC`
    )
    .all(lunchId);

  res.json({ lunch, signups, capacity: CAPACITY_PER_LUNCH });
});

app.post('/api/lunches/:lunchId/signup', (req, res) => {
  const { lunchId } = req.params;
  const { name, email, team } = req.body ?? {};

  if (!isNonEmptyString(name) || !isNonEmptyString(email) || !isNonEmptyString(team)) {
    return res.status(400).json({ error: 'name, email, and team are required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const lunch = db.prepare('SELECT id, title, starts_at, deleted_at FROM lunches WHERE id = ?').get(lunchId);
  if (!lunch) return res.status(404).json({ error: 'Lunch not found' });

  if (lunch.deleted_at) {
    return res.status(409).json({ error: 'This lunch has been removed' });
  }

  if (isPastLunch(lunch.starts_at)) {
    return res.status(409).json({ error: 'This lunch is in the past and is no longer accepting sign-ups' });
  }

  const emailNormalized = normalizeEmail(email);

  if (!isAllowedEmailDomain(emailNormalized)) {
    return res.status(400).json({ error: 'Please use your @wwt.com email address' });
  }

  try {
    const result = db.transaction(() => {
      const existing = db
        .prepare(
          `SELECT id, status
           FROM signups
           WHERE lunch_id = ? AND email = ?`
        )
        .get(lunchId, emailNormalized);

      if (existing && (existing.status === 'confirmed' || existing.status === 'waitlist')) {
        const err = new Error('DUPLICATE_ACTIVE');
        err.code = 'DUPLICATE_ACTIVE';
        throw err;
      }

      const used = db
        .prepare(
          `SELECT COUNT(1) AS count
           FROM signups
           WHERE lunch_id = ? AND status = 'confirmed'`
        )
        .get(lunchId).count;

      const status = used >= CAPACITY_PER_LUNCH ? 'waitlist' : 'confirmed';

      const trimmedName = name.trim();
      const trimmedTeam = team.trim();
      let signupId;

      if (existing && existing.status === 'cancelled') {
        db.prepare(
          `UPDATE signups
           SET name = ?, team = ?, status = ?, cancelled_at = NULL, created_at = datetime('now')
           WHERE id = ?`
        ).run(trimmedName, trimmedTeam, status, existing.id);
        signupId = existing.id;
      } else {
        const insert = db.prepare(
          `INSERT INTO signups (lunch_id, name, email, team, status)
           VALUES (?, ?, ?, ?, ?)`
        );
        const info = insert.run(lunchId, trimmedName, emailNormalized, trimmedTeam, status);
        signupId = info.lastInsertRowid;
      }

      let waitlistPosition = null;
      if (status === 'waitlist') {
        const createdAt = db
          .prepare(`SELECT created_at FROM signups WHERE id = ?`)
          .get(signupId)?.created_at;

        waitlistPosition = db
          .prepare(
            `SELECT COUNT(1) AS count
             FROM signups
             WHERE lunch_id = ?
               AND status = 'waitlist'
               AND created_at <= ?`
          )
          .get(lunchId, createdAt).count;
      }

      return { id: signupId, status, waitlistPosition, lunchTitle: lunch.title };
    })();

    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    if (e && e.code === 'DUPLICATE_ACTIVE') {
      return res.status(409).json({ error: 'This email is already signed up for this lunch' });
    }
    if (e && String(e.message || '').includes('UNIQUE')) {
      return res.status(409).json({ error: 'This email is already signed up for this lunch' });
    }
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.post('/api/lunches/:lunchId/cancel', (req, res) => {
  const { lunchId } = req.params;
  const { email } = req.body ?? {};

  if (!isNonEmptyString(email)) {
    return res.status(400).json({ error: 'email is required' });
  }

  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Please enter a valid email address' });
  }

  const lunch = db.prepare('SELECT id, starts_at, deleted_at FROM lunches WHERE id = ?').get(lunchId);
  if (!lunch) return res.status(404).json({ error: 'Lunch not found' });

  if (lunch.deleted_at) {
    return res.status(409).json({ error: 'This lunch has been removed' });
  }

  if (isPastLunch(lunch.starts_at)) {
    return res.status(409).json({ error: 'This lunch is in the past and can no longer be changed' });
  }

  const emailNormalized = normalizeEmail(email);

  if (!isAllowedEmailDomain(emailNormalized)) {
    return res.status(400).json({ error: 'Please use your @wwt.com email address' });
  }

  try {
    const out = db.transaction(() => {
      const existing = db
        .prepare(
          `SELECT id, status
           FROM signups
           WHERE lunch_id = ? AND email = ? AND status IN ('confirmed', 'waitlist')`
        )
        .get(lunchId, emailNormalized);

      if (!existing) {
        const err = new Error('Signup not found');
        err.code = 'NOT_FOUND';
        throw err;
      }

      db.prepare(
        `UPDATE signups
         SET status = 'cancelled', cancelled_at = datetime('now')
         WHERE id = ?`
      ).run(existing.id);

      let promoted = null;
      if (existing.status === 'confirmed') {
        const next = db
          .prepare(
            `SELECT id, name, email, team, created_at
             FROM signups
             WHERE lunch_id = ? AND status = 'waitlist'
             ORDER BY created_at ASC
             LIMIT 1`
          )
          .get(lunchId);

        if (next) {
          db.prepare(`UPDATE signups SET status = 'confirmed' WHERE id = ?`).run(next.id);
          promoted = { ...next, status: 'confirmed' };
        }
      }

      return { ok: true, promoted };
    })();

    return res.json(out);
  } catch (e) {
    if (e && e.code === 'NOT_FOUND') return res.status(404).json({ error: 'Signup not found' });
    return res.status(500).json({ error: 'Unexpected error' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  process.stdout.write(`Lunch signup app running on http://localhost:${port}\n`);
});

const path = require('path');
const express = require('express');
const { initDb } = require('./db');

const CAPACITY_PER_LUNCH = 6;

const LUNCHES = [
  {
    id: 'lunch-1',
    title: 'Lunch with Jason - St. Charles',
    starts_at: '2026-03-20T11:30:00-06:00',
    location: 'Tucanos'
  },
  {
    id: 'lunch-2',
    title: 'Lunch with Jason - Illinois',
    starts_at: '2026-06-15T11:30:00-06:00',
    location: 'Peel Wood Fired Pizza'
  },
  {
    id: 'lunch-3',
    title: 'Lunch 3',
    starts_at: '2026-03-04T12:00:00-06:00',
    location: 'TBD'
  }
];

const db = initDb({
  dbFilePath: path.join(__dirname, 'data', 'lunch-signups.db'),
  lunches: LUNCHES
});

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

app.get('/api/lunches', (req, res) => {
  const lunches = db
    .prepare(
      `SELECT id, title, starts_at, location
       FROM lunches
       ORDER BY starts_at ASC`
    )
    .all();

  const counts = db
    .prepare(
      `SELECT lunch_id, COUNT(1) AS count
       FROM signups
       GROUP BY lunch_id`
    )
    .all();

  const countByLunchId = new Map(counts.map((r) => [r.lunch_id, r.count]));

  res.json(
    lunches.map((l) => {
      const used = countByLunchId.get(l.id) ?? 0;
      return {
        ...l,
        capacity: CAPACITY_PER_LUNCH,
        used,
        remaining: Math.max(0, CAPACITY_PER_LUNCH - used)
      };
    })
  );
});

app.get('/api/lunches/:lunchId/signups', (req, res) => {
  const { lunchId } = req.params;
  const lunch = db
    .prepare('SELECT id, title, starts_at, location FROM lunches WHERE id = ?')
    .get(lunchId);

  if (!lunch) return res.status(404).json({ error: 'Lunch not found' });

  const signups = db
    .prepare(
      `SELECT name, email, team, created_at
       FROM signups
       WHERE lunch_id = ?
       ORDER BY created_at ASC`
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

  const lunch = db.prepare('SELECT id FROM lunches WHERE id = ?').get(lunchId);
  if (!lunch) return res.status(404).json({ error: 'Lunch not found' });

  const emailNormalized = normalizeEmail(email);

  try {
    const result = db.transaction(() => {
      const used = db
        .prepare('SELECT COUNT(1) AS count FROM signups WHERE lunch_id = ?')
        .get(lunchId).count;

      if (used >= CAPACITY_PER_LUNCH) {
        const err = new Error('Lunch is full');
        err.code = 'FULL';
        throw err;
      }

      const insert = db.prepare(
        `INSERT INTO signups (lunch_id, name, email, team)
         VALUES (?, ?, ?, ?)`
      );

      const info = insert.run(lunchId, name.trim(), emailNormalized, team.trim());

      return { id: info.lastInsertRowid };
    })();

    res.status(201).json({ ok: true, ...result });
  } catch (e) {
    if (e && e.code === 'FULL') return res.status(409).json({ error: 'Lunch is full' });
    if (e && String(e.message || '').includes('UNIQUE')) {
      return res.status(409).json({ error: 'This email is already signed up for this lunch' });
    }
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

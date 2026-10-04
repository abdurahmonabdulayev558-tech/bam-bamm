﻿import express from 'express'
import cors from 'cors'
import Database from 'better-sqlite3'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { existsSync, mkdirSync } from 'node:fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
// Baza joylashuvi: serverda DATA_DIR bo'lsa o'sha yer (masalan Render'ning doimiy diski),
// aks holda server papkasi yonida (lokal ishlatish uchun).
const dataDir = process.env.DATA_DIR || __dirname
// Papka mavjud bo'lmasa yaratamiz (masalan Fly.io'da /data).
if (!existsSync(dataDir)) mkdirSync(dataDir, { recursive: true })
const db = new Database(join(dataDir, 'data.db'))
db.pragma('journal_mode = WAL')

// ---------- Baza sxemasi ----------
db.exec(`
  CREATE TABLE IF NOT EXISTS parties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    subtitle TEXT NOT NULL DEFAULT '',
    icon TEXT NOT NULL DEFAULT 'вњЁ',
    tone TEXT NOT NULL DEFAULT 'mint',
    votes INTEGER NOT NULL DEFAULT 0,
    sort INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS teachers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    subject TEXT NOT NULL DEFAULT '',
    initials TEXT NOT NULL DEFAULT '',
    color TEXT NOT NULL DEFAULT 'purple',
    rating REAL NOT NULL DEFAULT 0,
    image TEXT NOT NULL DEFAULT '',
    login TEXT NOT NULL DEFAULT '',
    password TEXT NOT NULL DEFAULT ''
  );
  CREATE TABLE IF NOT EXISTS suggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    author TEXT NOT NULL DEFAULT 'Anonim oquvchi',
    group_name TEXT NOT NULL DEFAULT '',
    teacher TEXT NOT NULL DEFAULT '',
    votes INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'Yangi',
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voter TEXT NOT NULL,
    voter_id TEXT NOT NULL DEFAULT '',
    party TEXT NOT NULL,
    teacher TEXT NOT NULL DEFAULT '',
    voted_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS visitor_days (
    date TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`)

// ---------- Boshlang'ich (seed) ma'lumotlar ----------
const partyCount = db.prepare('SELECT COUNT(*) AS n FROM parties').get().n
if (partyCount === 0) {
  const insert = db.prepare('INSERT INTO parties (title, subtitle, icon, tone, votes, sort) VALUES (?, ?, ?, ?, ?, ?)')
  insert.run('Pizza Party', 'Issiq, pishloqli va hammaga tanish', 'рџЌ•', 'coral', 0, 1)
  insert.run('Fruit Party', 'Yangi mevalar va vitaminli kayfiyat', 'рџЌ“', 'mint', 0, 2)
  insert.run('Movie Night', 'Film, popcorn va yaxshi suhbat', 'в–¶', 'blue', 0, 3)
}

const teacherCount = db.prepare('SELECT COUNT(*) AS n FROM teachers').get().n
if (teacherCount === 0) {
  const insert = db.prepare('INSERT INTO teachers (name, subject, initials, color, rating, login, password) VALUES (?, ?, ?, ?, ?, ?, ?)')
  insert.run('Jasur Akmalov', 'IELTS Instructor', 'JA', 'blue', 4.9, 'jasur', 'jasur2026')
  insert.run('Malika Raximova', 'General English', 'MR', 'orange', 4.8, 'malika', 'malika2026')
  insert.run('Sobirov Sardor', 'Speaking Club', 'SS', 'green', 4.7, 'sardor', 'sardor2026')
}

// Boshlang'ich takliflar yo'q — ularni faqat o'quvchilar o'zi qo'shadi.

// ---------- Yordamchilar ----------
// Har kuni soat 20:00 da ovoz berish yakunlanadi (kunlik yangilanadi)
function getTodayDeadlineMs() {
  const end = new Date()
  end.setHours(20, 0, 0, 0)
  if (end.getTime() <= Date.now()) end.setDate(end.getDate() + 1)
  return end.getTime()
}
const getSetting = (key, fallback = '') => {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key)
  return row ? row.value : fallback
}
const setSetting = (key, value) => {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, String(value))
}
const initialsOf = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

if (!getSetting('voting_open', '')) {
  setSetting('voting_open', '1')
}
if (!getSetting('deadline', '')) {
  setSetting('deadline', getTodayDeadlineMs())
}

const partyRow = (r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, icon: r.icon, tone: r.tone, votes: r.votes })
const teacherRow = (r) => ({ id: r.id, name: r.name, subject: r.subject, initials: r.initials, color: r.color, rating: r.rating, votes: 0, image: r.image || undefined, login: r.login, password: r.password })
const suggestionRow = (r) => ({ id: r.id, text: r.text, author: r.author, group: r.group_name, teacher: r.teacher, votes: r.votes, status: r.status })
const voteRow = (r) => ({ name: r.voter, party: r.party, teacher: r.teacher, time: r.voted_at, voterId: r.voter_id })

// ---------- App ----------
const app = express()
app.use(cors())
app.use(express.json({ limit: '8mb' }))

// Barcha ma'lumotlar bir marta olinadi
app.get('/api/state', (req, res) => {
  // Muddat o'tgan bo'lsa вЂ” yangi kunga avtomatik o'tadi (real vaqt).
  const storedDeadline = Number(getSetting('deadline', '0'))
  if (storedDeadline <= Date.now()) setSetting('deadline', String(getTodayDeadlineMs()))
  res.json({
    parties: db.prepare('SELECT * FROM parties ORDER BY sort ASC, id ASC').all().map(partyRow),
    teachers: db.prepare('SELECT * FROM teachers ORDER BY id ASC').all().map(teacherRow),
    suggestions: db.prepare('SELECT * FROM suggestions ORDER BY created_at DESC').all().map(suggestionRow),
    votes: db.prepare('SELECT * FROM votes ORDER BY voted_at DESC LIMIT 100').all().map(voteRow),
    visitorDays: db.prepare('SELECT * FROM visitor_days ORDER BY date ASC').all(),
    votingOpen: getSetting('voting_open', '1') === '1',
    deadline: Number(getSetting('deadline', '0')),
  })
})

// --- Party ---
app.post('/api/parties/:id/vote', (req, res) => {
  const id = Number(req.params.id)
  const { voter, teacher, voterId } = req.body || {}
  if (getSetting('voting_open', '1') !== '1') return res.status(400).json({ error: 'voting_closed' })
  if (!voterId) return res.status(400).json({ error: 'no_voter_id' })
  if (!teacher) return res.status(400).json({ error: 'no_teacher' })
  const party = db.prepare('SELECT * FROM parties WHERE id = ?').get(id)
  if (!party) return res.status(404).json({ error: 'not_found' })
  const already = db.prepare('SELECT id FROM votes WHERE voter_id = ?').get(voterId)
  if (already) return res.status(409).json({ error: 'already_voted' })
  const tx = db.transaction(() => {
    db.prepare('UPDATE parties SET votes = votes + 1 WHERE id = ?').run(id)
    db.prepare('INSERT INTO votes (voter, voter_id, party, teacher, voted_at) VALUES (?, ?, ?, ?, ?)').run((voter || "O'quvchi").trim(), voterId, party.title, teacher, Date.now())
  })
  tx()
  res.json({ ok: true })
})

// Bitta o'quvchining ovozini bilish (qaytgan o'quvchi uchun)
app.get('/api/votes/mine/:voterId', (req, res) => {
  const row = db.prepare('SELECT * FROM votes WHERE voter_id = ?').get(req.params.voterId)
  res.json({ voted: !!row, vote: row ? voteRow(row) : null })
})

app.post('/api/parties', (req, res) => {
  const { title } = req.body || {}
  if (!title) return res.status(400).json({ error: 'no_title' })
  const maxSort = db.prepare('SELECT COALESCE(MAX(sort), 0) AS m FROM parties').get().m
  const info = db.prepare('INSERT INTO parties (title, subtitle, icon, tone, votes, sort) VALUES (?, ?, ?, ?, ?, ?)')
    .run(title, "Admin tomonidan qo'shilgan party", '✨', 'mint', 0, maxSort + 1)
  res.json({ id: info.lastInsertRowid })
})

// Party'ni tahrirlash (nomi va tavsifi)
app.put('/api/parties/:id', (req, res) => {
  const id = Number(req.params.id)
  const cur = db.prepare('SELECT * FROM parties WHERE id = ?').get(id)
  if (!cur) return res.status(404).json({ error: 'not_found' })
  const b = req.body || {}
  const title = (b.title ?? cur.title).trim()
  if (!title) return res.status(400).json({ error: 'no_title' })
  const subtitle = (b.subtitle ?? cur.subtitle).trim()
  const tx = db.transaction(() => {
    db.prepare('UPDATE parties SET title = ?, subtitle = ? WHERE id = ?').run(title, subtitle, id)
    // Nom o'zgargan bo'lsa — eski ovozlarni yangi nomga bog'laymiz.
    if (cur.title && cur.title !== title) {
      db.prepare('UPDATE votes SET party = ? WHERE party = ?').run(title, cur.title)
    }
  })
  tx()
  res.json({ ok: true })
})

// Party'ni o'chirish (ovozlari bilan birga)
app.delete('/api/parties/:id', (req, res) => {
  const id = Number(req.params.id)
  const cur = db.prepare('SELECT * FROM parties WHERE id = ?').get(id)
  if (!cur) return res.status(404).json({ error: 'not_found' })
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM parties WHERE id = ?').run(id)
    db.prepare('DELETE FROM votes WHERE party = ?').run(cur.title)
  })
  tx()
  res.json({ ok: true })
})

app.post('/api/parties/reset', (req, res) => {
  db.prepare('UPDATE parties SET votes = 0').run()
  db.prepare('DELETE FROM votes').run()
  db.prepare('DELETE FROM suggestions').run()
  db.prepare('DELETE FROM visitor_days').run()
  db.prepare("DELETE FROM settings WHERE key LIKE 'seen_%'").run()
  setSetting('voting_open', '1')
  setSetting('deadline', String(getTodayDeadlineMs()))
  res.json({ ok: true })
})

// --- Ovoz holati ---
app.post('/api/settings/voting', (req, res) => {
  setSetting('voting_open', req.body?.open ? '1' : '0')
  res.json({ ok: true })
})

// --- Ustozlar ---
app.post('/api/teachers', (req, res) => {
  const b = req.body || {}
  if (!b.name || !b.subject || !b.login || !b.password) return res.status(400).json({ error: 'missing_fields' })
  try {
    db.prepare('INSERT INTO teachers (name, subject, initials, color, rating, image, login, password) VALUES (?, ?, ?, ?, 0, ?, ?, ?)')
      .run(b.name.trim(), b.subject.trim(), initialsOf(b.name.trim()), b.color || 'purple', b.image || '', b.login.trim(), b.password.trim())
  } catch (e) {
    return res.status(409).json({ error: 'exists' })
  }
  res.json({ ok: true })
})

app.put('/api/teachers/:id', (req, res) => {
  const id = Number(req.params.id)
  const b = req.body || {}
  const cur = db.prepare('SELECT * FROM teachers WHERE id = ?').get(id)
  if (!cur) return res.status(404).json({ error: 'not_found' })
  const name = (b.name ?? cur.name).trim()
  const login = (b.login ?? cur.login).trim()
  const password = (b.password ?? cur.password).trim()
  if (!name || !login || !password) return res.status(400).json({ error: 'missing_fields' })
  // Login boshqa ustozda band emasligini tekshiramiz
  const clash = db.prepare('SELECT id FROM teachers WHERE lower(login) = lower(?) AND id != ?').get(login, id)
  if (clash) return res.status(409).json({ error: 'login_taken' })
  // Ism boshqa ustozda band emasligini tekshiramiz
  const nameClash = db.prepare('SELECT id FROM teachers WHERE name = ? AND id != ?').get(name, id)
  if (nameClash) return res.status(409).json({ error: 'name_taken' })
  const oldName = cur.name
  const tx = db.transaction(() => {
    db.prepare('UPDATE teachers SET name = ?, subject = ?, initials = ?, image = ?, login = ?, password = ? WHERE id = ?')
      .run(name, (b.subject ?? cur.subject).trim(), initialsOf(name), b.image ?? cur.image, login, password, id)
    // Ustoz ismi o'zgargan bo'lsa вЂ” eski ovozlar va takliflarni yangi ismga bog'laymiz,
    // shunda ustoz panelida eski o'quvchilar/takliflar yo'qolib qolmaydi.
    if (oldName && oldName !== name) {
      db.prepare('UPDATE votes SET teacher = ? WHERE teacher = ?').run(name, oldName)
      db.prepare('UPDATE suggestions SET teacher = ? WHERE teacher = ?').run(name, oldName)
    }
  })
  tx()
  res.json({ ok: true })
})

app.post('/api/teachers/:id/rate', (req, res) => {
  const id = Number(req.params.id)
  const value = Number(req.body?.value)
  if (!(value >= 1 && value <= 5)) return res.status(400).json({ error: 'bad_value' })
  db.prepare('UPDATE teachers SET rating = ? WHERE id = ?').run(value, id)
  res.json({ ok: true })
})

app.post('/api/teachers/login', (req, res) => {
  const { login, password } = req.body || {}
  const row = db.prepare('SELECT * FROM teachers WHERE lower(login) = lower(?) AND password = ?').get((login || '').trim(), password)
  if (!row) return res.status(401).json({ error: 'invalid' })
  res.json({ teacher: teacherRow(row) })
})

// --- Takliflar ---
app.post('/api/suggestions', (req, res) => {
  const b = req.body || {}
  if (!b.text || !b.teacher) return res.status(400).json({ error: 'missing_fields' })
  db.prepare('INSERT INTO suggestions (text, author, group_name, teacher, votes, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(b.text.trim(), b.author || "Anonim o'quvchi", b.group || '', b.teacher, 0, 'Yangi', Date.now())
  res.json({ ok: true })
})

// --- Tashrifchilar (kunlik) ---
app.post('/api/visitors/hit', (req, res) => {
  const { visitorId, date } = req.body || {}
  if (!visitorId || !date) return res.status(400).json({ error: 'missing_fields' })
  const key = 'seen_' + date + '_' + visitorId
  if (getSetting(key, '') === '1') {
    const day = db.prepare('SELECT count FROM visitor_days WHERE date = ?').get(date)
    return res.json({ counted: false, count: day?.count || 0 })
  }
  setSetting(key, '1')
  db.prepare('INSERT INTO visitor_days (date, count) VALUES (?, 1) ON CONFLICT(date) DO UPDATE SET count = count + 1').run(date)
  const day = db.prepare('SELECT count FROM visitor_days WHERE date = ?').get(date)
  res.json({ counted: true, count: day.count })
})

// Production'da backend frontend (dist) fayllarini ham bersin вЂ” bitta manzil, bitta host.
// Buning uchun avval `npm run build` qilinishi kerak.
const distDir = join(__dirname, '..', 'dist')
if (existsSync(distDir)) {
  // Keshlanishni oldini olamiz вЂ” brauzer har doim eng yangi kodni oladi.
  app.use(express.static(distDir, {
    etag: false,
    lastModified: false,
    setHeaders: (res) => {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate')
    },
  }))
  // SPA marshrutlari: /admin, /teacher va h.k. index.html ga qaytadi.
  // (Express 5'da '*' yo'l ishlamaydi вЂ” regex ishlatamiz.)
  app.get(/^(?!\/api).*/, (req, res) => {
    res.sendFile(join(distDir, 'index.html'))
  })
}

const PORT = Number(process.env.PORT) || 4000
const server = app.listen(PORT, () => console.log(`Time Party в†’ http://localhost:${PORT}`))

// Port band bo'lsa yoki boshqa xato bo'lsa вЂ” aniq va tushunarli xabar beramiz.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\nвќЊ ${PORT}-port band. Ehtimol eski server hali ishlab turibdi.`)
    console.error('   Yechim: barcha eski node processlarini to\'xtatib, qayta urinib ko\'ring.\n')
  } else {
    console.error('\nвќЊ Server ishga tushmadi:', err.message, '\n')
  }
  process.exit(1)
})

// Toza to'xtash (Ctrl+C yoki boshqa signal).
const shutdown = () => {
  server.close(() => {
    try { db.close() } catch { /* allaqachon yopilgan */ }
    process.exit(0)
  })
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

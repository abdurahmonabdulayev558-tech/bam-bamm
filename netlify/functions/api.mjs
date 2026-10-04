// ============================================================
//  Netlify Function — Time Party backend
// ============================================================
//  Netlify statik host, shuning uchun SQLite o'rniga Netlify Blobs
//  (kalit-qiymat saqlash) ishlatamiz. Butun baza bitta JSON hujjat
//  sifatida "time-party" store'da "db" kaliti ostida saqlanadi.
//
//  Barcha /api/* so'rovlari shu funksiyaga yo'naltiriladi (netlify.toml).
// ============================================================

import { getStore } from '@netlify/blobs'

const STORE_NAME = 'time-party'
const DB_KEY = 'db'

// ---------- Baza ----------
let _store = null
function store() {
  if (!_store) _store = getStore(STORE_NAME)
  return _store
}

function emptyDb() {
  return {
    parties: [],
    teachers: [],
    suggestions: [],
    votes: [],
    visitorDays: [],
    settings: {},
    seq: { parties: 0, teachers: 0, suggestions: 0, votes: 0 },
  }
}

async function loadDb() {
  try {
    const raw = await store().get(DB_KEY, { type: 'text' })
    if (!raw) return seed(emptyDb())
    const db = JSON.parse(raw)
    // Eski/kam maydonlarni to'ldiramiz (moslik uchun).
    const base = emptyDb()
    const merged = { ...base, ...db }
    merged.seq = { ...base.seq, ...(db.seq || {}) }
    merged.settings = db.settings || {}
    if (!merged.parties.length && !merged.teachers.length) return seed(merged)
    // Eski (demo) seed takliflarini bir marta tozalab tashlaymiz.
    // Faqat aynan shu matn+muallif juftliklari o'chadi, o'quvchi qo'shganlariga tegmaydi.
    const demoKeys = [
      'Burger party|Aziza Karimova',
      'Karaoke kechasi|Bekzod Ismoilov',
      'Sushi workshop|Madina Tojiboyeva',
    ]
    merged.suggestions = merged.suggestions.filter(
      (s) => !demoKeys.includes(`${s.text}|${s.author}`),
    )
    return merged
  } catch {
    return seed(emptyDb())
  }
}

async function saveDb(db) {
  await store().set(DB_KEY, JSON.stringify(db))
}

function nextId(db, table) {
  db.seq[table] = (db.seq[table] || 0) + 1
  return db.seq[table]
}

function seed(db) {
  db.parties = [
    { id: nextId(db, 'parties'), title: 'Pizza Party', subtitle: 'Issiq, pishloqli va hammaga tanish', icon: '🍕', tone: 'coral', votes: 0, sort: 1 },
    { id: nextId(db, 'parties'), title: 'Fruit Party', subtitle: 'Yangi mevalar va vitaminli kayfiyat', icon: '🍓', tone: 'mint', votes: 0, sort: 2 },
    { id: nextId(db, 'parties'), title: 'Movie Night', subtitle: 'Film, popcorn va yaxshi suhbat', icon: '▶', tone: 'blue', votes: 0, sort: 3 },
  ]
  db.teachers = [
    { id: nextId(db, 'teachers'), name: 'Jasur Akmalov', subject: 'IELTS Instructor', initials: 'JA', color: 'blue', rating: 4.9, image: '', login: 'jasur', password: 'jasur2026' },
    { id: nextId(db, 'teachers'), name: 'Malika Raximova', subject: 'General English', initials: 'MR', color: 'orange', rating: 4.8, image: '', login: 'malika', password: 'malika2026' },
    { id: nextId(db, 'teachers'), name: 'Sobirov Sardor', subject: 'Speaking Club', initials: 'SS', color: 'green', rating: 4.7, image: '', login: 'sardor', password: 'sardor2026' },
  ]
  // Boshlang'ich takliflar yo'q — ularni faqat o'quvchilar o'zi qo'shadi.
  db.suggestions = []
  db.settings = { voting_open: '1', deadline: String(getTodayDeadlineMs()) }
  return db
}

// ---------- Yordamchilar ----------
function getTodayDeadlineMs() {
  const end = new Date()
  end.setHours(20, 0, 0, 0)
  if (end.getTime() <= Date.now()) end.setDate(end.getDate() + 1)
  return end.getTime()
}

const initialsOf = (name) => name.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase()

const partyRow = (r) => ({ id: r.id, title: r.title, subtitle: r.subtitle, icon: r.icon, tone: r.tone, votes: r.votes })
const teacherRow = (r) => ({ id: r.id, name: r.name, subject: r.subject, initials: r.initials, color: r.color, rating: r.rating, votes: 0, image: r.image || undefined, login: r.login, password: r.password })
const suggestionRow = (r) => ({ id: r.id, text: r.text, author: r.author, group: r.group_name, teacher: r.teacher, votes: r.votes, status: r.status })
const voteRow = (r) => ({ name: r.voter, party: r.party, teacher: r.teacher, time: r.voted_at, voterId: r.voter_id })

// ---------- HTTP javob yordamchilari ----------
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  })

// ---------- Handler ----------
export default async (req, context) => {
  const url = new URL(req.url)
  const path = url.pathname.replace(/^\/api/, '') || '/'
  const method = req.method.toUpperCase()

  if (method === 'OPTIONS') return json({ ok: true })

  let body = {}
  if (method === 'POST' || method === 'PUT') {
    try { body = await req.json() } catch { body = {} }
  }

  const db = await loadDb()
  const seg = path.split('/').filter(Boolean) // masalan: ['parties','3','vote']

  const ensureDeadline = () => {
    const stored = Number(db.settings.deadline || 0)
    if (stored <= Date.now()) db.settings.deadline = String(getTodayDeadlineMs())
  }

  // ===== GET /state =====
  if (method === 'GET' && path === '/state') {
    ensureDeadline()
    await saveDb(db)
    return json({
      parties: db.parties.slice().sort((a, b) => (a.sort - b.sort) || (a.id - b.id)).map(partyRow),
      teachers: db.teachers.slice().sort((a, b) => a.id - b.id).map(teacherRow),
      suggestions: db.suggestions.slice().sort((a, b) => b.created_at - a.created_at).map(suggestionRow),
      votes: db.votes.slice().sort((a, b) => b.voted_at - a.voted_at).slice(0, 100).map(voteRow),
      visitorDays: db.visitorDays.slice().sort((a, b) => (a.date < b.date ? -1 : 1)),
      votingOpen: db.settings.voting_open === '1',
      deadline: Number(db.settings.deadline || 0),
    })
  }

  // ===== GET /votes/mine/:voterId =====
  if (method === 'GET' && seg[0] === 'votes' && seg[1] === 'mine' && seg[2]) {
    const row = db.votes.find((v) => v.voter_id === decodeURIComponent(seg[2]))
    return json({ voted: !!row, vote: row ? voteRow(row) : null })
  }

  // ===== POST /parties/:id/vote =====
  if (method === 'POST' && seg[0] === 'parties' && seg[2] === 'vote') {
    const id = Number(seg[1])
    const { voter, teacher, voterId } = body
    if (db.settings.voting_open !== '1') return json({ error: 'voting_closed' }, 400)
    if (!voterId) return json({ error: 'no_voter_id' }, 400)
    if (!teacher) return json({ error: 'no_teacher' }, 400)
    const party = db.parties.find((p) => p.id === id)
    if (!party) return json({ error: 'not_found' }, 404)
    if (db.votes.some((v) => v.voter_id === voterId)) return json({ error: 'already_voted' }, 409)
    party.votes += 1
    db.votes.push({ id: nextId(db, 'votes'), voter: (voter || "O'quvchi").trim(), voter_id: voterId, party: party.title, teacher, voted_at: Date.now() })
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /parties (qo'shish) =====
  if (method === 'POST' && path === '/parties') {
    if (!body.title) return json({ error: 'no_title' }, 400)
    const maxSort = db.parties.reduce((m, p) => Math.max(m, p.sort || 0), 0)
    db.parties.push({ id: nextId(db, 'parties'), title: body.title, subtitle: "Admin tomonidan qo'shilgan party", icon: '✨', tone: 'mint', votes: 0, sort: maxSort + 1 })
    await saveDb(db)
    return json({ id: db.parties[db.parties.length - 1].id })
  }

  // ===== PUT /parties/:id (tahrirlash) =====
  if (method === 'PUT' && seg[0] === 'parties' && seg[1] && seg.length === 2) {
    const id = Number(seg[1])
    const cur = db.parties.find((p) => p.id === id)
    if (!cur) return json({ error: 'not_found' }, 404)
    const title = (body.title ?? cur.title).trim()
    if (!title) return json({ error: 'no_title' }, 400)
    const oldTitle = cur.title
    cur.title = title
    cur.subtitle = (body.subtitle ?? cur.subtitle).trim()
    // Nom o'zgargan bo'lsa — eski ovozlarni yangi nomga bog'laymiz.
    if (oldTitle && oldTitle !== title) {
      db.votes.forEach((v) => { if (v.party === oldTitle) v.party = title })
    }
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== DELETE /parties/:id (o'chirish) =====
  if (method === 'DELETE' && seg[0] === 'parties' && seg[1] && seg.length === 2) {
    const id = Number(seg[1])
    const cur = db.parties.find((p) => p.id === id)
    if (!cur) return json({ error: 'not_found' }, 404)
    db.parties = db.parties.filter((p) => p.id !== id)
    // O'chirilgan party uchun berilgan ovozlarni ham olib tashlaymiz.
    db.votes = db.votes.filter((v) => v.party !== cur.title)
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /parties/reset =====
  if (method === 'POST' && path === '/parties/reset') {
    db.parties.forEach((p) => { p.votes = 0 })
    db.votes = []
    db.suggestions = []
    db.visitorDays = []
    Object.keys(db.settings).forEach((k) => { if (k.startsWith('seen_')) delete db.settings[k] })
    db.settings.voting_open = '1'
    db.settings.deadline = String(getTodayDeadlineMs())
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /settings/voting =====
  if (method === 'POST' && path === '/settings/voting') {
    db.settings.voting_open = body.open ? '1' : '0'
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /teachers (qo'shish) =====
  if (method === 'POST' && path === '/teachers') {
    const { name, subject, login, password, color, image } = body
    if (!name || !subject || !login || !password) return json({ error: 'missing_fields' }, 400)
    if (db.teachers.some((t) => t.name === name.trim())) return json({ error: 'exists' }, 409)
    db.teachers.push({ id: nextId(db, 'teachers'), name: name.trim(), subject: subject.trim(), initials: initialsOf(name.trim()), color: color || 'purple', rating: 0, image: image || '', login: login.trim(), password: password.trim() })
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== PUT /teachers/:id =====
  if (method === 'PUT' && seg[0] === 'teachers' && seg[1] && seg.length === 2) {
    const id = Number(seg[1])
    const cur = db.teachers.find((t) => t.id === id)
    if (!cur) return json({ error: 'not_found' }, 404)
    const name = (body.name ?? cur.name).trim()
    const login = (body.login ?? cur.login).trim()
    const password = (body.password ?? cur.password).trim()
    if (!name || !login || !password) return json({ error: 'missing_fields' }, 400)
    if (db.teachers.some((t) => t.id !== id && t.login.toLowerCase() === login.toLowerCase())) return json({ error: 'login_taken' }, 409)
    if (db.teachers.some((t) => t.id !== id && t.name === name)) return json({ error: 'name_taken' }, 409)
    const oldName = cur.name
    cur.name = name
    cur.subject = (body.subject ?? cur.subject).trim()
    cur.initials = initialsOf(name)
    cur.image = body.image ?? cur.image
    cur.login = login
    cur.password = password
    if (oldName && oldName !== name) {
      db.votes.forEach((v) => { if (v.teacher === oldName) v.teacher = name })
      db.suggestions.forEach((s) => { if (s.teacher === oldName) s.teacher = name })
    }
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /teachers/:id/rate =====
  if (method === 'POST' && seg[0] === 'teachers' && seg[1] && seg[2] === 'rate') {
    const id = Number(seg[1])
    const value = Number(body.value)
    if (!(value >= 1 && value <= 5)) return json({ error: 'bad_value' }, 400)
    const t = db.teachers.find((x) => x.id === id)
    if (t) t.rating = value
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /teachers/login =====
  if (method === 'POST' && path === '/teachers/login') {
    const { login, password } = body
    const row = db.teachers.find((t) => t.login.toLowerCase() === (login || '').trim().toLowerCase() && t.password === password)
    if (!row) return json({ error: 'invalid' }, 401)
    return json({ teacher: teacherRow(row) })
  }

  // ===== POST /suggestions =====
  if (method === 'POST' && path === '/suggestions') {
    const { text, teacher, author, group } = body
    if (!text || !teacher) return json({ error: 'missing_fields' }, 400)
    db.suggestions.push({ id: nextId(db, 'suggestions'), text: text.trim(), author: author || "Anonim o'quvchi", group_name: group || '', teacher, votes: 0, status: 'Yangi', created_at: Date.now() })
    await saveDb(db)
    return json({ ok: true })
  }

  // ===== POST /visitors/hit =====
  if (method === 'POST' && path === '/visitors/hit') {
    const { visitorId, date } = body
    if (!visitorId || !date) return json({ error: 'missing_fields' }, 400)
    const key = 'seen_' + date + '_' + visitorId
    if (db.settings[key] === '1') {
      const day = db.visitorDays.find((d) => d.date === date)
      return json({ counted: false, count: day?.count || 0 })
    }
    db.settings[key] = '1'
    const day = db.visitorDays.find((d) => d.date === date)
    if (day) day.count += 1
    else db.visitorDays.push({ date, count: 1 })
    await saveDb(db)
    const saved = db.visitorDays.find((d) => d.date === date)
    return json({ counted: true, count: saved.count })
  }

  return json({ error: 'not_found', path, method }, 404)
}

// Netlify Functions API — marshrut shu orqali aniqlanadi.
export const config = {
  path: '/api/*',
}

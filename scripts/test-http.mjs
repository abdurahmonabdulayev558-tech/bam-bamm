// Real HTTP test: ishga tushgan Netlify dev serverga so'rov yuboradi.
const BASE = process.env.BASE || 'http://localhost:8888'

async function call(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  return { status: res.status, data }
}

let pass = 0, fail = 0
const ok = (cond, name) => { if (cond) { pass++; console.log('  OK  ', name) } else { fail++; console.log('  FAIL', name) } }

// Avval reset qilib, toza holatdan boshlaymiz.
await call('POST', '/api/parties/reset')

console.log('\n== API testlari (real HTTP) ==')
let r = await call('GET', '/api/state')
ok(r.status === 200, 'GET /state -> 200')
ok(r.data.parties.length === 3, "3 ta party seed bo'ldi")
ok(r.data.teachers.length === 3, "3 ta ustoz seed bo'ldi")
ok(r.data.votingOpen === true, 'ovoz berish ochiq')

const partyId = r.data.parties[0].id
r = await call('POST', `/api/parties/${partyId}/vote`, { voter: 'Ali', teacher: 'Jasur Akmalov', voterId: 'v-test-1' })
ok(r.status === 200 && r.data.ok, 'ovoz berildi')

r = await call('POST', `/api/parties/${partyId}/vote`, { voter: 'Ali', teacher: 'Jasur Akmalov', voterId: 'v-test-1' })
ok(r.status === 409 && r.data.error === 'already_voted', 'takror ovoz bloklandi')

r = await call('GET', '/api/votes/mine/v-test-1')
ok(r.data.voted === true, 'GET /votes/mine -> voted')

r = await call('POST', '/api/teachers/login', { login: 'jasur', password: 'jasur2026' })
ok(r.status === 200 && r.data.teacher.name === 'Jasur Akmalov', 'ustoz login ishladi')

r = await call('POST', '/api/teachers/login', { login: 'jasur', password: 'xato' })
ok(r.status === 401, "noto'g'ri parol -> 401")

r = await call('POST', '/api/suggestions', { text: 'Test taklif', teacher: 'Malika Raximova', author: 'Bek' })
ok(r.status === 200, "taklif qo'shildi")

r = await call('POST', '/api/visitors/hit', { visitorId: 'v1', date: '2026-01-01' })
ok(r.data.counted === true && r.data.count === 1, 'tashrif sanaldi')
r = await call('POST', '/api/visitors/hit', { visitorId: 'v1', date: '2026-01-01' })
ok(r.data.counted === false && r.data.count === 1, 'bir kunda qayta sanalmadi')

r = await call('POST', '/api/parties', { title: 'Yangi Party' })
ok(r.status === 200 && r.data.id, "yangi party qo'shildi")

r = await call('POST', '/api/settings/voting', { open: false })
ok(r.status === 200, 'ovoz berishni yopdi')
r = await call('POST', `/api/parties/${partyId}/vote`, { voter: 'Vali', teacher: 'Jasur Akmalov', voterId: 'v-test-2' })
ok(r.status === 400 && r.data.error === 'voting_closed', 'yopiqda ovoz bloklandi')
await call('POST', '/api/settings/voting', { open: true })

r = await call('POST', '/api/parties/reset')
ok(r.status === 200, 'reset ishladi')
r = await call('GET', '/api/state')
ok(r.data.votes.length === 0 && r.data.suggestions.length === 0, "resetdan keyin bo'sh")

r = await call('GET', '/api/nomalum')
ok(r.status === 404, "noma'lum yo'l -> 404")

console.log(`\nNatija: ${pass} o'tdi, ${fail} yiqildi\n`)
process.exit(fail ? 1 : 0)

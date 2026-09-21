// Bazadagi test ma'lumotlarini tozalash (0 dan boshlash uchun).
// party va ustozlar qoladi; ovozlar, takliflar, tashriflar o'chadi.
import Database from 'better-sqlite3'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const db = new Database(join(here, 'data.db'))

db.prepare('DELETE FROM votes').run()
db.prepare('UPDATE parties SET votes = 0').run()
db.prepare('DELETE FROM suggestions').run()
db.prepare('DELETE FROM visitor_days').run()
db.prepare("DELETE FROM settings WHERE key LIKE 'seen_%'").run()
db.prepare('DELETE FROM settings WHERE key = ?').run('deadline')

console.log('TOZALANDI:')
console.log('  parties:', db.prepare('SELECT COUNT(*) AS n FROM parties').get().n)
console.log('  teachers:', db.prepare('SELECT COUNT(*) AS n FROM teachers').get().n)
console.log('  votes:', db.prepare('SELECT COUNT(*) AS n FROM votes').get().n)
console.log('  suggestions:', db.prepare('SELECT COUNT(*) AS n FROM suggestions').get().n)
console.log('  visitor_days:', db.prepare('SELECT COUNT(*) AS n FROM visitor_days').get().n)
db.close()

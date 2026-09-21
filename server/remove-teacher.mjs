import Database from 'better-sqlite3'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const db = new Database(join(dirname(fileURLToPath(import.meta.url)), 'data.db'))

const names = process.argv.slice(2) // o'chiriladigan loginlar
for (const login of names) {
  const r = db.prepare('DELETE FROM teachers WHERE login = ?').run(login)
  console.log(login + ' -> ochirildi: ' + r.changes)
}

console.log('QOLGAN USTOZLAR:')
db.prepare('SELECT name, login, password FROM teachers ORDER BY id').all()
  .forEach((x) => console.log('  ' + x.name + ' | ' + x.login + ' | ' + x.password))
db.close()

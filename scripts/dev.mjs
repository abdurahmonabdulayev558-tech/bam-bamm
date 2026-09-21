// Ikkala serverni bitta node process ichida ishga tushiradi (concurrently shart emas).
// Bu Windows'da "spawn cmd.exe ENOENT" muammosini butunlay oldini oladi.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const children = []

function start(name, command, args, cwd) {
  const child = spawn(command, args, {
    cwd,
    stdio: 'inherit',
    shell: false,
    // Windows'da node/npm/.cmd fayllarni to'g'ri topish uchun.
    windowsHide: false,
  })
  child.on('error', (err) => {
    console.error(`[${name}] ishga tushmadi:`, err.message)
  })
  child.on('exit', (code) => {
    console.log(`[${name}] to'xtadi (kod: ${code}). Boshqa serverlar ham to'xtatilmoqda...`)
    shutdown()
  })
  children.push(child)
  return child
}

let shuttingDown = false
function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  for (const c of children) { try { c.kill() } catch { /* allaqachon to'xtagan */ } }
  setTimeout(() => process.exit(0), 300)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

console.log('Time Party ishga tushirilmoqda...\n')

// Backend (Express + SQLite)
start('server', process.execPath, [join(root, 'server', 'index.js')], join(root, 'server'))
// Frontend (Vite dev server)
start('web', process.execPath, [join(root, 'node_modules', 'vite', 'bin', 'vite.js')], root)

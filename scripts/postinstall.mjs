// ============================================================
//  postinstall — Netlify'da xato bermasligi uchun xavfsiz skript
// ============================================================
//  - Netlify'da (CI) faqat frontend bog'liqliklari kerak, SQLite server kerak emas.
//    Shu sababli Netlify'da server/ papkasi o'rnatilmaydi.
//  - Lokal kompyuterda esa server/ ham o'rnatiladi (haqiqiy backend bilan ishlash uchun).
// ============================================================

import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { spawnSync } from 'node:child_process'

const root = dirname(fileURLToPath(import.meta.url))
const serverDir = join(root, '..', 'server')

// Netlify CI muhitida server/papka o'rnatilmaydi (kerak emas).
if (process.env.NETLIFY === 'true') {
  console.log('[postinstall] Netlify muhiti — server/ o\'rnatilmadi (backend Netlify Functions\'da).')
  process.exit(0)
}

if (!existsSync(join(serverDir, 'package.json'))) {
  process.exit(0)
}

console.log('[postinstall] server/ bog\'liqliklari o\'rnatilmoqda...')
const res = spawnSync('npm', ['--prefix', serverDir, 'install'], { stdio: 'inherit', shell: true })
if (res.status !== 0) {
  console.warn('[postinstall] server/ o\'rnatilmadi (xato). Lokal backend kerak bo\'lsa qo\'lda o\'rnating: npm --prefix server install')
}

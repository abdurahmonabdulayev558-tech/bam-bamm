# 🚀 Deploy qo'llanma
## ✅ Netlify'ga qo'yish — TO'LIQ ISHLAYDI
Loyiha Netlify uchun moslashtirilgan:
- Backend → **Netlify Function** (`netlify/functions/api.mjs`)
- Baza → **Netlify Blobs** (SQLite o'rniga) — server qayta ishga tushsa ham saqlanadi
- Frontend → statik host (`dist`)
- Barcha `/api/*` so'rovlari funksiyaga yo'naltiriladi (`netlify.toml`)

Ya'ni ovoz berish, ustoz qo'shish, taklif — hammasi Netlify'da ishlaydi va saqlanadi.

### Netlify'ga qo'yish qadamlari
1. **GitHub'ga yuklang:**
   ```powershell
   git init
   git add .
   git commit -m "Time Party - Netlify uchun tayyor"
   git branch -M main
   git remote add origin https://github.com/SIZNING_USERNAME/time-party.git
   git push -u origin main
   ```
2. **netlify.com** → *Add new site* → *Import an existing project* → GitHub repongizni tanlang.
3. Sozlamalar `netlify.toml`dan avtomatik olinadi:
   - Build: `npm run build`
   - Publish: `dist`
   - Functions: `netlify/functions`
4. **Deploy site** bosing. Tayyor!

Yoki terminal orqali: `npx netlify init` → `npx netlify deploy --build --prod`.

> Lokal sinash: `npx netlify dev` (real Blobs + Functions) → `http://localhost:8888`

---

## 📜 Eski holat: Netlify'da SQLite ishlamaydi
Quyidagi matn **eski SQLite (`server/`) versiyasi** uchun tegishli edi. Endi Netlify Function + Blobs ishlatiladi.

Netlify **faqat statik sayt** joylaydi. Bu loyihada esa **haqiqiy backend** (Node.js + SQLite baza) bor.
Netlify'да sahifalar ochiladi, lekin **hech narsa saqlanmaydi** (ovoz, ustoz, taklif).

---

## 🥇 ENG YAXSHI: Fly.io (bepul + uxlamaydi)

**Nega Fly.io?**
- ✅ **Uxlamaydi** — doim ishlab turadi (Render bepul tarifi 15 daqiqada uxlaydi)
- ✅ **Bepul** — kichik ilova uchun yetadi
- ✅ **Doimiy disk** — baza saqlanadi (server qayta ishga tushsa ham yo'qolmaydi)
- ✅ SQLite to'liq ishlaydi

### 1-qadam: Fly.io CLI o'rnatish

PowerShell'да:
```powershell
iwr https://fly.io/install.ps1 -useb | iex
```

Yangi terminal ochib, tekshiring:
```powershell
flyctl version
```

### 2-qadam: Fly.io'ga kirish

```powershell
flyctl auth signup      # yoki: flyctl auth login
```
Brauzer ochiladi — Google/GitHub bilan kirsangiz bo'ladi (karta talab qilmaydi).

### 3-qadam: Loyihani joylash

```powershell
cd "c:\Users\Hannsz\Desktop\time party"
flyctl launch
```

Savollarga javob bering:
- **"Would you like to copy its configuration to the new app?"** → `No` (chunki `fly.toml` bor)
- **"Do you want to tweak these settings?"** → `No`

### 4-qadam: Doimiy disk yaratish (baza uchun)

```powershell
flyctl volumes create time_party_data --size 1 --region fra
```

### 5-qadam: Joylash!

```powershell
flyctl deploy
```

### 6-qadam: Tayyor!

```powershell
flyctl open
```

Manzil shunga o'xshaydi: `https://time-party.fly.dev`

- **Sayt:** `https://time-party.fly.dev`
- **Admin:** `https://time-party.fly.dev/admin`
- **Ustoz:** `https://time-party.fly.dev/teacher`

### 🔄 Yangilash

Kod o'zgartirsangiz:
```powershell
flyctl deploy
```

---

## 🥈 Muqobil: Koyeb (bepul + uxlamaydi)

1. [koyeb.com](https://koyeb.com) ga kiring (GitHub bilan)
2. **"Create Service"** → **"GitHub"** → repongizni tanlang
3. Sozlamalar:
   - **Builder:** Dockerfile
   - **Run command:** `node server/index.js`
   - **Port:** `8080`
4. **"Deploy"** bosing

Koyeb ham uxlamaydi, lekin doimiy disk bepul tarifда cheklangan.

---

## ⚠️ Render haqida (agar ishlatsangiz)

- **Bepul tarif uxlaydi** — 15 daqiqa harakatsizlikdan keyin, keyin 30-60s "uyg'onadi"
- **Doimiy disk yo'q** (bepul tarifда) — baza qayta tiklanadi
- Faqat **test/namoyish** uchun yaroqli

Render'да `render.yaml` tayyor: **Web Service** → repongizni tanlang → hammasi avtomatik.

---

## 📊 Taqqoslash

| Host | Uxlaydimi? | Baza saqlanadi? | Bepul? |
|------|-----------|-----------------|--------|
| **Fly.io** | ✅ Yo'q | ✅ Ha (disk) | ✅ Ha |
| **Koyeb** | ✅ Yo'q | ⚠️ Cheklangan | ✅ Ha |
| **Railway** | ⚠️ Kredit tugasa | ✅ Ha | ⚠️ $5/oy kredit |
| **Render** | ❌ 15 daq uxlaydi | ❌ Yo'q | ✅ Ha |
| **Netlify** | ❌ Umuman ishlamaydi | ❌ Yo'q | ✅ Ha |

**Xulosa: Fly.io — eng yaxshi tanlov.**

---

## 📋 Deploy muhit o'zgaruvchilari

| O'zgaruvchi | Qiymat | Izoh |
|-------------|--------|------|
| `PORT` | `8080` | Server porti (Fly.io avtomatik beradi) |
| `DATA_DIR` | `/data` | Baza joylashuvi (doimiy disk) |
| `NODE_ENV` | `production` | Ishlab chiqarish rejimi |

---

## 🧪 Lokal sinab ko'rish (deploydan oldin)

Production rejimini **aynan hostdagidek** sinash:

```powershell
$env:DATA_DIR = "$PWD\_data"
$env:PORT = "4100"
npm run build
node server/index.js
```

Brauzerda: `http://localhost:4100`

Bu aynan Fly.io'даги kabi ishlaydi (baza `_data` papkasida yaratiladi).

---

## 🐳 Docker bilan sinash (Fly.io aynan Docker ishlatadi)

```powershell
docker build -t time-party .
docker run -p 8080:8080 -v time-party-data:/data time-party
```

Brauzerda: `http://localhost:8080`

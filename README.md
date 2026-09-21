# Time School Party 🎉

O'quv markazi uchun "Time Party" tizimi — **haqiqiy umumiy baza** bilan (hamma kompyuter bir xil ma'lumotni ko'radi).

## Tuzilishi

```
time party/
├── src/                 # React frontend (student / admin / teacher)
│   ├── main.tsx
│   ├── api.ts           # backend bilan aloqa
│   └── styles.css
├── server/              # Node.js backend (Express + SQLite)
│   ├── index.js
│   └── data.db          # baza fayli (avtomatik yaratiladi)
└── package.json
```

## Ishga tushirish

Avval barcha paketlarni o'rnatish (bir marta):

```powershell
npm run install:all
```

Keyin ishlab chiqish (dev) rejimida ishga tushirish — **ikkala server** birga ko'tariladi:

```powershell
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend API: `http://localhost:4000`

### Production (bitta server)

```powershell
npm run start
```

Bu avval frontend'ni build qiladi, keyin bitta serverda (`http://localhost:4000`)
ham sahifani, ham API'ni beradi.

## 🚀 Deploy (Netlify)

Loyiha **Netlify uchun to'liq tayyor**:

- **Frontend** → statik host (`dist`)
- **Backend** → **Netlify Function** (`netlify/functions/api.mjs`)
- **Baza** → **Netlify Blobs** (SQLite o'rniga, server qayta ishga tushsa ham saqlanadi)

### Qadamlar
1. Kodni GitHub'ga yuklang:
   ```powershell
   git init
   git add .
   git commit -m "Time Party - Netlify uchun tayyor"
   git branch -M main
   git remote add origin https://github.com/SIZNING_USERNAME/time-party.git
   git push -u origin main
   ```
2. [netlify.com](https://netlify.com) → **Add new site** → **Import an existing project** → GitHub repongizni tanlang.
3. Sozlamalar `netlify.toml`dan avtomatik olinadi (build `npm run build`, publish `dist`, functions `netlify/functions`).
4. **Deploy site** bosing — tayyor!

> Terminal orqali: `npx netlify init` → `npx netlify deploy --build --prod`
>
> Lokal sinash (real Blobs + Functions): `npx netlify dev` → http://localhost:8888
>
> Boshqa hostinglar (Fly.io, Koyeb, Render) uchun batafsil qo'llanma: **[DEPLOY.md](DEPLOY.md)**

## Kirish ma'lumotlari

| Panel | Manzil | Login | Parol |
|-------|--------|-------|-------|
| **Admin** | `/admin` | `timeschool` | `112231` |
| **Ustoz** | `/teacher` | admin qo'shgan login/parol | — |

Boshlang'ich ustozlar (keyinchalik admin o'zgartira oladi):

- `jasur` / `jasur2026`
- `malika` / `malika2026`
- `sardor` / `sardor2026`

## Imkoniyatlar

- **O'quvchi** (`/`) — avval ustozni tanlaydi, keyin party'ga ovoz beradi.
- **Admin** (`/admin`) — statistika, ovoz berishni boshqarish, ustoz qo'shish/tahrirlash,
  kunlik tashriflar tarixi ("qaysi kuni qancha odam kirdi").
- **Ustoz** (`/teacher`) — o'z reytingi, o'zini tanlagan o'quvchilar, takliflar.

## Muhim eslatmalar

- Barcha ma'lumotlar **serverdagi SQLite bazada** saqlanadi — har bir qurilma bir xil ma'lumotni ko'radi.
- Brauzerda `localStorage` faqat **shaxsiy holat** uchun qoladi (men ovoz berdimmi, kim sifatida kirganman).
- Kunlik tashrif: bitta brauzer kuniga faqat **1 marta** sanaladi.
- `VITE_API_URL` muhit o'zgaruvchisi orqali API manzilini boshqacha qilish mumkin
  (bo'sh bo'lsa — bir xil hostning `/api` yo'li ishlatiladi).

# Fly.io uchun Docker image.
# Bir bosqichda: frontend build + backend ishlatish.

FROM node:20-slim

# better-sqlite3 uchun kerakli tizim kutubxonalari
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Root paketlarni o'rnatish (frontend)
COPY package.json package-lock.json ./
RUN npm install

# Backend paketlarini o'rnatish
COPY server/package.json server/package-lock.json* ./server/
RUN npm --prefix server install

# Butun kodni ko'chirish
COPY . .

# Frontend'ni build qilish
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8080
ENV DATA_DIR=/data

EXPOSE 8080

# Bitta serverda: ham sayt, ham API (/admin, /teacher bilan)
CMD ["node", "server/index.js"]

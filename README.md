# Mini E-Commerce Platform

A full-stack e-commerce demo: NestJS API + Next.js storefront + admin panel, backed by PostgreSQL.

---

## Quick start (from a clean clone)

### Prerequisites
- Node.js ≥ 22, npm ≥ 10
- Docker + Docker Compose

### 1. Start Postgres

```bash
cp .env.example .env          # edit if needed
docker compose up -d
docker compose ps             # db should show "healthy"
```

### 2. Start the API (port 3001)

```bash
cd api
cp .env.example .env          # matches root .env creds by default
npm install
npx prisma migrate dev        # apply schema + run prisma generate
npx prisma db seed            # seed users, categories, products
npm run start:dev
```

Health check: `curl http://localhost:3001/health` → `{"status":"ok"}`

### 3. Start the web app (port 3000)

```bash
cd web
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Seeded credentials

| Role     | Email                | Password      |
|----------|----------------------|---------------|
| Admin    | admin@ecomm.dev      | Admin1234!    |
| Customer | customer@ecomm.dev   | Customer1234! |

Seed creates 2 users, 4 categories (Electronics, Clothing, Books, Home & Garden), and 20 products with stock.

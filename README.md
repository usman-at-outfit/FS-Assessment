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

---

## Key URLs

| Path | Description |
|------|-------------|
| `http://localhost:3000/` | Storefront — catalog, cart, checkout, orders |
| `http://localhost:3000/admin` | Admin panel — products, orders, dashboard |
| `http://localhost:3001/health` | API health check |
| `http://localhost:3001/uploads/<file>` | Uploaded product images |

---

## Environment variables

### `api/.env` (copy from `api/.env.example`)

| Variable | Default | Purpose |
|----------|---------|---------|
| `DATABASE_URL` | `postgresql://ecomm:ecomm_pass@localhost:5432/ecomm_db` | Postgres connection |
| `PORT` | `3001` | API listen port |
| `JWT_SECRET` | _required_ | Sign/verify JWT tokens (generate with `openssl rand -hex 64`) |
| `WEB_ORIGIN` | `http://localhost:3000` | CORS allowed origin |
| `API_PUBLIC_URL` | `http://localhost:3001` | Base URL for absolute upload URLs |
| `STRIPE_SECRET_KEY` | `sk_test_REPLACE_ME` | Stripe secret key — get from [dashboard.stripe.com/test/apikeys](https://dashboard.stripe.com/test/apikeys) |

### `web/.env.local` (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `NEXT_PUBLIC_API_URL` | `http://localhost:3001` | API base URL for browser fetches |

---

## Stripe Hosted Checkout

The checkout page has two tabs: **Card** (mock, no real charge) and **Pay with Stripe** (real Stripe redirect).

To test Stripe:
1. Add a real `sk_test_*` key to `api/.env` → `STRIPE_SECRET_KEY`
2. In the storefront, add items to cart → checkout → Pay with Stripe
3. Use Stripe test card `4242 4242 4242 4242`, any future date, any CVC
4. On success you're redirected back to `/checkout?session_id=…` where the order is confirmed

Without a real key the Stripe tab shows a 502 error — the Card tab always works.

---

## File uploads

The admin product form supports multi-image uploads via `POST /uploads` (ADMIN only).
Images are stored in `api/uploads/` and served at `http://localhost:3001/uploads/<filename>`.
The first image in a product's gallery also becomes the primary thumbnail (`Product.imageUrl`).

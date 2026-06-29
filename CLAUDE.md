# CLAUDE.md — Mini E-Commerce Platform

This file is the steering context for the build. Read it before every task. If anything here
conflicts with what I ask in a prompt, **stop and flag the conflict** rather than guessing.

---

## 1. What we're building

A single-API e-commerce platform with two frontends sharing one backend:
- **Storefront** — catalog, product detail, cart, checkout (mock payment), order history, auth.
- **Admin panel** — product CRUD, order management, analytics dashboard, admin-only access.

**Guiding principle (from the spec): _working over polished, coherent over complete._**
Breadth that connects end-to-end beats depth in one corner. If time is short, keep the
storefront path whole and trim admin depth — never ship a broken checkout.

---

## 2. Stack & layout

- **Backend:** NestJS (monolith), Prisma ORM, PostgreSQL.
- **Frontend:** Next.js (App Router) + React.
- **Auth:** JWT (access token), `argon2` password hashing, role-based guard.
- **DB:** Postgres via `docker-compose` so a clean clone runs with one command.

```
/                  docker-compose.yml (postgres), README.md, NOTES.md
/api               NestJS app
  /src
    /auth          login, signup, JWT strategy, RolesGuard
    /products      catalog read + admin CRUD
    /cart          per-user persisted cart
    /orders        checkout, order creation, status lifecycle
    /suggestions   the open-ended "relevant products" feature
    /admin         dashboard analytics
    /common        DTOs, filters, interceptors, guards
  /prisma          schema.prisma, migrations, seed.ts
/web               Next.js app
  /app             routes (storefront + /admin)
  /components      UI built from our own design system (see §7)
  /lib             api client, auth context
```

---

## 3. Data model (authoritative — build Prisma schema to match)

- **User**: id, email (unique), passwordHash, role (`CUSTOMER` | `ADMIN`), createdAt.
- **Category**: id, name (unique), slug.
- **Product**: id, name, description, **priceCents (Int)**, imageUrl, stock (Int), categoryId, createdAt.
- **Cart**: id, userId (unique — one active cart per user). **CartItem**: id, cartId, productId, quantity.
- **Order**: id, userId, status (enum), **totalCents (Int)**, createdAt.
- **OrderItem**: id, orderId, productId, **unitPriceCents (Int — snapshot at purchase)**, quantity.

### Hard rules on the model
- **Money is integer cents everywhere (`priceCents`, `totalCents`, `unitPriceCents`).** Never floats.
  Document this choice in NOTES.md (avoids float rounding; format to currency only at the UI edge).
- **OrderItem stores a price snapshot.** Read the product price *at checkout time* and copy it into
  `unitPriceCents`. Never compute historical order totals from the live `Product.priceCents` — prices change.
- **Order status enum:** `PENDING → PROCESSING → SHIPPED → DELIVERED`, plus `CANCELLED`.
  Allowed transitions only: PENDING→PROCESSING, PROCESSING→SHIPPED, SHIPPED→DELIVERED,
  and (PENDING|PROCESSING)→CANCELLED. Reject anything else server-side with 422.

---

## 4. Data-integrity rules (this is graded — get it right)

- **Checkout runs inside a Prisma transaction.** In one transaction: re-read product rows, verify
  `stock >= quantity` for every line, compute the total from snapshotted prices, decrement stock,
  create Order + OrderItems. If any line is short, abort the whole transaction and return 409 with
  which items failed. No partial orders, no negative stock.
- **Quantities** must be positive integers. Reject `<= 0` and non-integers at the DTO layer.
- **Cart is server-authoritative.** Never trust client-sent prices or totals — recompute on the server.

---

## 5. Security & authz rules

- Passwords hashed with `argon2` (or bcrypt). **Never** store or log plaintext passwords.
- Secrets (JWT secret, DB URL) come from env only. **Nothing secret in the repo** — provide `.env.example`.
- **Ownership:** a customer can only read/modify *their own* cart and *their own* orders. Enforce by
  deriving userId from the JWT, never from a request param/body. Trying to access another user's
  resource → 403 (or 404 to avoid leaking existence — pick one and be consistent).
- **Admin gate:** all `/admin/*` and product-write/order-status endpoints require role `ADMIN` via
  `RolesGuard`. A logged-in customer hitting them → 403. Verify this with a test (see test-writer agent).

---

## 6. API conventions

- **Validation:** every endpoint uses a `class-validator` DTO with a global `ValidationPipe`
  (`whitelist: true, forbidNonWhitelisted: true, transform: true`). Bad input → 400 with field detail.
- **Errors:** use Nest's `HttpException` subclasses. A global exception filter returns
  `{ statusCode, message, error }`. **No raw stack traces to the client.**
- **Status codes:** 200/201 success, 400 validation, 401 unauthenticated, 403 forbidden,
  404 not found, 409 conflict (stock), 422 invalid state transition.
- **Catalog list endpoint** supports: `search` (name, case-insensitive), `category`, `minPrice`/`maxPrice`
  (in the same cents unit), `sort` (`price_asc|price_desc|newest`), `page`/`pageSize` (paginate — never
  return the whole table). Return `{ items, total, page, pageSize }`.

---

## 7. Design (must be ours, via a design agent)

The UI/UX is generated and shaped through **Claude Design**, not lifted from a template/UI kit.
Workflow: produce a small **design system first** (color tokens, type scale, spacing, button/input/
card/table primitives), then the key layouts (catalog grid, product detail, cart, checkout, order
history, auth; admin table, product form, order management, dashboard-with-chart). Implement against
those tokens. Headless primitives (Radix/shadcn unstyled) are fine as building blocks; the *look and
structure* must be ours and consistent across storefront and admin. Dashboard needs **one real chart**
(Recharts is quick). Log the design iterations in NOTES.md §Design workflow.

---

## 8. Open-ended requirement — "relevant product suggestions"

**Our interpretation (implement this, justify in NOTES.md):** category-affinity recommendations.
Suggest in-stock products from the categories the user has previously ordered or currently has in
their cart, ranked by sales volume (units sold), excluding items they already own/have in cart.
**Cold-start fallback:** a brand-new user with no history sees global bestsellers. Cheap to compute,
no ML, handles the new-user case deliberately. Note in NOTES.md the alternatives rejected for time
(collaborative filtering, "customers also bought") and why.

---

## 9. How we work (agentic workflow — this is the headline grade)

- **One module at a time.** Scope → instruct → review the diff → run it → commit. Do not run several
  modules ahead unsupervised.
- **Commit in logical increments** with clear messages (conventional commits). **No single "final dump" commit.**
- **When a requirement is genuinely ambiguous, ask** — don't let the agent invent. Document every
  resolved assumption in NOTES.md.
- After writing any feature, hand the diff to the `reviewer` subagent and the tricky logic to the
  `test-writer` subagent before committing.
- Keep a running mistakes log (NOTES.md §"Where the agent failed"): every time the agent gets
  something subtly wrong and how it was caught.

---

## 10. Commands (keep these working from a clean clone)

```bash
docker compose up -d                 # postgres
# api
cd api && npm install
npx prisma migrate dev               # apply schema
npm run seed                         # seed admin + customer + products
npm run start:dev                    # backend
npm test                             # tests
# web
cd web && npm install && npm run dev # frontend
```

**Seed must create:** ≥1 admin user, ≥1 customer, ~20 products across several categories with stock.
Print the seeded login credentials so the app is usable immediately. Put those creds in the README too.

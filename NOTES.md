# NOTES.md

> Fill this in **as you go**, not at the end. The graders read it closely — the agent-failure and
> supervision sections are explicitly called out as among the most important.

---

## Stack & why

- **Backend:** NestJS (monolith) + Prisma 7 + PostgreSQL 16.
- **Frontend:** Next.js 16 (App Router) + React + Tailwind CSS.
- **Auth:** JWT access tokens, `argon2` password hashing, role-based guard.
- **Prisma version note:** Prisma 7.8 was resolved by npm (latest). Prisma 7 introduced two
  breaking changes relevant here: (a) `url` is no longer set in `schema.prisma` — it lives in
  `prisma.config.ts`; (b) the default generator (`prisma-client`) outputs ESM TypeScript to
  `generated/prisma/` instead of CJS to `node_modules/.prisma/client`. The generated client
  uses `import.meta.url` (ESM-only). For NestJS CJS compatibility we use the adapter-based
  runtime: `PrismaClient` from `@prisma/client` + `PrismaPg` adapter from `@prisma/adapter-pg`.
  This gives us a working `$connect()` / `$disconnect()` lifecycle without needing any models
  to be defined yet (the stub in `.prisma/client/index.js` has an empty data model but a
  working engine). Models and `prisma generate` happen in M1 — `prisma-client` generator in
  schema.prisma is configured but not yet run.

---

## Agent workflow

- **Tool(s) used:** Claude Code for the build; Claude Design for the UI.
- **Project context:** a `CLAUDE.md` holding stack, data model, integrity/security rules, conventions,
  and guardrails (incl. "ask before guessing"). Two purpose-built subagents: `reviewer` (diff review)
  and `test-writer` (tests for the tricky logic).
- **How tasks were scoped:** one module at a time — scope → instruct → review diff → run → commit.
  <add detail: how you broke the spec into modules, any reusable prompts>
- **Context management:** <how you kept context tight — e.g. pointing the agent at CLAUDE.md instead of
  re-explaining, scoping each prompt to one module, clearing between phases>

---

## Where the agent helped, and where it failed ← (high-value section — keep a running log)

| #   | What the agent did                                                   | Right / Wrong                                                                                  | How I caught it                                  | Fix                                                                                                                        |
| --- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 1   | Planned `PrismaService extends PrismaClient` with `$connect()` in M0 | Wrong — Prisma 5 can't `generate` without models; Prisma 7 broke `url` in schema               | Test run failed; error surfaced during execution | Switched to adapter-based `PrismaClient` from `@prisma/client` stub + `PrismaPg` adapter; deferred `prisma generate` to M1 |
| 2   | Specified `version: "3.9"` in docker-compose.yml                     | Wrong (obsolete, causes warning)                                                               | `docker compose up` printed warning              | Removed `version` key                                                                                                      |
| 3   | Planned to downgrade Prisma to v5                                    | Wrong — `npm install prisma@5` silently no-oped (peer dep conflict); Prisma 7 was still active | Version check after install showed 7.8           | Kept Prisma 7 and adapted to its adapter/config pattern                                                                    |
| 4   | M1: placed `prisma.seed` in `package.json` (Prisma 5/6 pattern)     | Wrong — Prisma 7 reads seed from `prisma.config.ts` `migrations.seed`                         | `npx prisma db seed` said "No seed command configured" | Moved seed to `prisma.config.ts`                                                                                   |
| 5   | M1: assumed `prisma-client` generator needed for Prisma 7            | Unnecessary — `prisma-client-js` still works in Prisma 7, generates CJS to `@prisma/client`   | Tested both generators                           | Kept `prisma-client-js`; avoids ESM/CJS mismatch in NestJS                                                                |
| 6   | M2: no fail-fast on missing `JWT_SECRET`                             | Wrong — `JwtModule` silently signs tokens with `undefined` as the secret; any token signed with the string `"undefined"` is accepted | Reviewer subagent flagged it | Added `if (!process.env.JWT_SECRET) throw new Error(...)` in `main.ts` before `NestFactory.create` |
| 7   | M2: `RolesGuard` returned `false` on role mismatch                   | Suboptimal — returning `false` emits Nest's default 403 body which does not match our `{ statusCode, message, error }` contract | Reviewer subagent flagged it | Changed to `throw new ForbiddenException()` so `AllExceptionsFilter` formats the response |
| 8   | M2: `LoginDto.password` had no presence validation                   | Wrong — empty string `""` passed DTO validation and triggered a full argon2.verify (slow, minor DoS vector) | Reviewer subagent flagged it | Added `@IsNotEmpty()` |
| 9   | M2: `jest.spyOn(argon2, 'hash')` in tests                           | Wrong — argon2 is a native addon; Node marks its exports non-configurable, so Jest's spy `Object.defineProperty` throws | Test-writer subagent encountered and fixed it | Use `jest.mock('argon2')` (hoisted before import) instead |
| 10  | M3-M6: `PATCH /orders/:id/status` had method-level `@UseGuards(RolesGuard)` while JWT guard was class-level | Fragile — if NestJS resolves method-level guards first, `req.user` could be undefined when `RolesGuard` runs | Reviewer subagent flagged it | Changed handler to `@UseGuards(JwtAuthGuard, RolesGuard)` — explicit ordering in one decorator |
| 11  | M6: `exclude` query param parsed with bare `parseInt()` in controller | Wrong — `parseInt('abc',10)` returns `NaN`, which passes `[NaN]::int[]` to PostgreSQL and throws a 500 | Reviewer subagent flagged it | Replaced with a proper DTO class using `@IsOptional @IsInt @Min(1)` so bad values return 400 |
| 12  | M5: cart loaded outside `$transaction` in checkout | TOCTOU gap — cart quantities could change between the outer read and the transaction start under concurrent requests | Reviewer subagent flagged it | Moved `cart.findUnique` inside the `$transaction` callback |
| 13  | M5: client-side checkout showed shipping ($5.99) but server totalCents excluded it | UX mismatch — customer sees one total, stored order reflects a different amount | Reviewer subagent flagged it | Added `shippingCents` calculation to server-side checkout; extracted `SHIPPING_CENTS` / `FREE_SHIP_THRESHOLD` to `web/lib/constants.ts` shared by both client display and referenced by server logic |
| 14  | M3: `pageSize` DTO had no upper bound | Wrong — a client could pass `pageSize=999999` and dump the entire products table | Reviewer subagent flagged it | Added `@Max(100)` to `pageSize` in `QueryProductsDto` |

_Narrative:_ The most interesting failure was the Prisma version mismatch. The agent planned
Prisma 5/6-style `url = env("DATABASE_URL")` in `schema.prisma` and `extends PrismaClient`,
but npm resolved Prisma 7 (latest), which removed `url` from the schema file entirely and moved
connection config to `prisma.config.ts`. The Prisma 7 generated client also uses `import.meta.url`
(ESM-only), incompatible with NestJS's default CJS runtime. Rather than fighting both changes,
the adapter pattern (`PrismaPg`) was used: it bypasses the generated engine entirely and connects
via `pg.Pool`, which is CJS-safe. The stub `.prisma/client/index.js` in Prisma 7 has an empty
data model and a working `getPrismaClient()` factory, so `$connect()` succeeds even before any
models are defined.

---

## Supervision & verification

- **How I reviewed output rather than accepting it blind:** <diff review per module; ran the app and
  exercised the path; reviewer subagent pass before commit>
- **Tests:** <what you tested and why those were the highest-value targets — totals/snapshot, stock,
  authz, status transitions. Quality over quantity.>
- **Edge cases handled:** <ordering more than stock; quantity <= 0; cross-user access; invalid status
  transition; price changed after order placed>

---

## Design workflow

- **Design agent(s):** Claude Design.
- **How I directed it:** built a design system first (tokens: color, type scale, spacing; primitives:
  button/input/card/table), then key layouts for storefront and admin, then implemented against it.
- **Iteration:** <how many passes; what you changed; how you kept storefront + admin consistent>
- **What's ours vs. building blocks:** <e.g. visual language and layout are ours; headless primitives
  (Radix/shadcn unstyled) used as un-styled scaffolding only>

---

## Assumptions

- **Money:** stored as integer cents end-to-end to avoid float rounding; formatted to currency only at
  the UI edge.
- **Order-status colors:** Pending is mapped to a neutral color rather than amber, so all five
  order states (pending, processing, shipped, delivered, cancelled) stay visually distinct at a
  glance in the admin order table.
- **Product image:** <image URL vs upload — state which and why (time trade-off)>.
- **Open-ended "relevant suggestions":** interpreted as **category-affinity** — in-stock products from
  categories the user has ordered or has in cart, ranked by units sold, excluding items already owned/in
  cart; **cold-start fallback** to global bestsellers for new users. Rejected for time: collaborative
  filtering and "customers also bought" (need interaction data / heavier compute for marginal gain here).
- **Other:** <every other decision you made on anything ambiguous>

---

## Trade-offs & scope

- **Built fully:** <list>
- **Mocked / simplified:** <e.g. payment is Stripe test mode / clearly-mocked step; image via URL; etc.>
- **Known security trade-off — JWT in localStorage:** The auth token is stored in `localStorage` (XSS-readable) with a JS-accessible cookie copy for Next.js middleware redirects. `HttpOnly` was intentionally omitted so the client can decode the payload for UI state (user name, role). In production this would move to an `HttpOnly` cookie set by the API `/auth/login` response, with a `/auth/me` endpoint returning user info so the frontend never decodes the token itself.
- **With more time I would:** refresh tokens, optimistic cart UI, richer analytics, file uploads
  to object storage, rate limiting, e2e tests

---

## Running it (mirror of README, quick reference)

```bash
docker compose up -d
cd api && npm install && npx prisma migrate dev && npm run seed && npm run start:dev
cd web && npm install && npm run dev
```

Seeded logins: admin `<email/pass>`, customer `<email/pass>`.

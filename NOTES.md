# NOTES.md

> Fill this in **as you go**, not at the end. The graders read it closely — the agent-failure and
> supervision sections are explicitly called out as among the most important.

---

## Stack & why

- **Backend:** NestJS (monolith) + Prisma + PostgreSQL.
- **Frontend:** Next.js (App Router) + React.
- **Auth:** JWT access tokens, `argon2` password hashing, role-based guard.
- _Why this stack:_ <one or two lines — productivity, matches the suggested stack, etc.>

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

## Where the agent helped, and where it failed  ← (high-value section — keep a running log)

| # | What the agent did | Right / Wrong | How I caught it | Fix |
|---|--------------------|---------------|-----------------|-----|
| 1 | <e.g. order total computed from live product price> | Wrong (subtle) | reviewer flagged missing snapshot | switched to OrderItem.unitPriceCents |
| 2 | | | | |
| 3 | | | | |

_Narrative:_ <a few sentences on the most interesting mistake — what made it subtle, why the agent
went there, and how your review process surfaced it.>

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
- **Order status model:** PENDING → PROCESSING → SHIPPED → DELIVERED, plus CANCELLED from
  PENDING/PROCESSING; no transitions out of DELIVERED.
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
- **With more time I would:** <e.g. refresh tokens, optimistic cart UI, richer analytics, file uploads
  to object storage, rate limiting, e2e tests>

---

## Running it (mirror of README, quick reference)

```bash
docker compose up -d
cd api && npm install && npx prisma migrate dev && npm run seed && npm run start:dev
cd web && npm install && npm run dev
```
Seeded logins: admin `<email/pass>`, customer `<email/pass>`.

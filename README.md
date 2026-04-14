# WoodOps (Atelier Pelissier)

Operations hub for a custom cabinetry shop. Covers the full path from first
client conversation through production, purchasing, time tracking, and final
invoice reconciliation. One system, four roles, one source of truth.

**Stack:** Next.js 14 · React 18 · Tailwind · Prisma · PostgreSQL (Neon) ·
Supabase Auth · OpenAI · LlamaParse (PDF fallback)
**Roles:** Admin · Planner · Salesperson · Woodworker

## Getting started

```bash
cp .env.local.example .env.local   # fill in DATABASE_URL + Supabase + OpenAI
npm install
npx prisma migrate deploy
npx prisma generate
npm run dev                        # http://localhost:3000
```

Everything you need about the database, environment variables, backup, and
recovery lives in [`DATA.md`](./DATA.md).

## Orientation for a new developer

Read these in order:

1. **[`ROADMAP.md`](./ROADMAP.md)** — the master backlog and current state by
   role. Starts with the end-to-end flow the app is trying to support and the
   gaps that still exist.
2. **[`docs/OPERATIONS_MATURITY_ROADMAP.md`](./docs/OPERATIONS_MATURITY_ROADMAP.md)** —
   16-section maturity scorecard. This is how we measure whether the app is
   ready for daily use per domain.
3. **[`docs/PHASE_1_OPERATIONAL_MATURITY_PLAN.md`](./docs/PHASE_1_OPERATIONAL_MATURITY_PLAN.md)** —
   detailed workstream specs (WS-1 through WS-8) for the active phase.
4. **[`docs/IMPLEMENTATION_BOARD.md`](./docs/IMPLEMENTATION_BOARD.md)** —
   ticket-ready execution plan. Use it for sprint assignment.
5. **[`docs/PHASE_2_LEAN_REFACTOR_PLAN.md`](./docs/PHASE_2_LEAN_REFACTOR_PLAN.md)** —
   queued for after Phase 1 has 4 weeks of usage data. Do not start yet.

## Where the interesting code lives

| Concern | Entry point |
|---------|-------------|
| Role-based "what should I do next?" spine | `src/lib/workflow/nextAction.ts` |
| Role-aware list + cards | `src/app/page.tsx`, `src/components/ProjectCard.tsx` |
| Project detail + header CTA | `src/app/projects/[id]/page.tsx`, `src/components/NextActionButton.tsx` |
| New-project wizard (stage picker → basics → rooms → review) | `src/app/projects/new/page.tsx` |
| PDF invoice intake → field pre-fill | `src/lib/invoice/parseInvoiceText.ts`, `src/app/api/projects/parse-invoice/route.ts` |
| Pricing engines (vanity / side unit / countertop / kitchen) | `src/lib/pricing/` |
| Ingredient engine + material snapshots | `src/lib/ingredients/` |
| Observability / deviation engine | `src/lib/recalculate.ts`, `src/lib/deviations.ts` |
| Auth & role resolution | `src/lib/auth/session.ts`, `src/lib/auth/roles.ts`, `src/hooks/useCurrentUser.ts` |
| AI assistant + action approval | `src/lib/ai/` |

## Core concepts worth knowing before editing

- **Sales lifecycle stage** (`Project.stage`) — `quote` / `invoiced` /
  `confirmed`. Drives the salesperson's next-action path and isolates the
  pre-deposit queue from production. See `nextAction.ts`.
- **Role-aware next-action** — every project card and detail page resolves a
  single "most important next step" CTA via `getNextAction(project, role)`.
  That's the guided-workflow spine; do not bypass it when adding new list
  contexts.
- **Section-canonical vanity/side-unit layout** — sections are the single
  source of truth for layout. `VanityInputs.drawers`/`doors` are derived
  totals kept for pricing compatibility only. Legacy projects synthesise one
  implicit section on load.
- **Material snapshot vs live estimate** — the ingredient engine always
  computes a *live estimate* from current config. A *saved snapshot* is the
  operational truth; any ingredient-driving config change marks it stale. See
  `src/lib/ingredients/snapshot.ts`.
- **Readiness gate (advisory)** — `computeReadinessCheck` exists in
  `src/lib/readiness.ts` but is not yet hard-enforced on `PATCH
  /api/projects/[id]`. Hard enforcement is workstream WS-1.

## Testing

```bash
npx jest                 # full unit suite (15 suites, 119 tests at last count)
npx tsc --noEmit         # type check
npm run lint             # eslint (pre-existing warnings on legacy files)
```

There is no e2e suite yet. UI changes should be validated manually against
the dev server per the role stories in `ROADMAP.md`.

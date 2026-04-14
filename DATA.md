# Data, environment & recovery

> **Status:** Canonical reference for where WoodOps stores its data, how to
> run it locally, and how to recover from problems. If this file and
> `README.md` disagree, this file wins.
>
> Last updated: 2026-04-14

---

## 1. Where the data lives

WoodOps is a Next.js 14 app backed by **PostgreSQL on Neon**, managed via
**Prisma**. Authentication is handled by **Supabase Auth**; the user records
Supabase owns are mirrored into the app database on first login (see
`src/lib/auth/session.ts`).

| Layer | Service | Notes |
|-------|---------|-------|
| App data (projects, clients, inventory, audit, snapshots, etc.) | Neon Postgres | Connection string in `DATABASE_URL` |
| Authentication (users, sessions, password reset) | Supabase Auth | Keys in `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` |
| AI assistant + action approval | OpenAI | `OPENAI_API_KEY` |
| PDF OCR fallback | LlamaParse | `LLAMAPARSE_API_KEY` (optional) |
| Host / runtime | Vercel | Production deploy; Prisma reads `DATABASE_URL` from Vercel env |

There is **no SQLite** anywhere in this project. An older version of this doc
referenced `prisma/dev.db` — that was removed when the stack moved to Neon.

## 2. Environment setup

Copy `.env.local.example` to `.env.local` and fill in the values. Minimum set
for a working local dev server:

```bash
DATABASE_URL=postgresql://...            # Neon branch URL
NEXT_PUBLIC_SUPABASE_URL=...             # Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY=...        # Supabase anon key
OPENAI_API_KEY=sk-...                    # For the AI assistant
```

Then:

```bash
npm install
npx prisma migrate deploy   # apply migrations to your DB
npx prisma generate         # regenerate the Prisma client
npm run dev                 # http://localhost:3000
```

For a clean dev database, use a Neon branch (free and instant) rather than
touching the production branch. See `docs/BACKUP_AND_RECOVERY.md` if it
exists; if not, follow the Neon point-in-time recovery flow from their docs.

## 3. Schema source of truth

`prisma/schema.prisma` is the canonical model definition. Every migration in
`prisma/migrations/` corresponds to one named change. The latest migrations at
time of writing:

| Migration | Summary |
|-----------|---------|
| `20260411120000_add_ingredients_snapshots_standards` | Ingredient engine, material snapshots, construction standards |
| `20260412000000_add_project_stage` | Sales lifecycle `Project.stage` + follow-up thresholds |

After editing `schema.prisma` locally, always run `npx prisma migrate dev
--name <description>` — never hand-edit an existing migration.

## 4. Backup & export

- **Automated:** Neon provides point-in-time recovery and branch snapshots by
  default. Confirm in the Neon console that retention covers the window you
  need.
- **Manual JSON dump:** `GET /api/export` returns projects + distributors as
  JSON. This is a partial dump — it does not cover inventory, orders,
  snapshots, or audit logs. Treat it as a safety net for small fixes, not a
  real backup.
- **Schema rollback:** use `npx prisma migrate resolve --rolled-back <name>`
  in a Neon branch, never directly against production.

## 5. Regenerating auth + roles

Supabase holds the source of truth for auth. App-side roles live on the
`Employee` record and are cached on the client via `useCurrentUser()`. If you
change someone's role:

1. Update the `Employee.role` row in the DB (via admin UI or `prisma studio`).
2. The next page load picks it up through `GET /api/auth/me`.
3. If you're impersonating, end the impersonation first — it otherwise masks
   the underlying role.

## 6. What to do when something breaks

| Symptom | First check |
|---------|-------------|
| "Cannot find module '@prisma/client'" | Run `npx prisma generate` |
| Migration mismatch on startup | Run `npx prisma migrate deploy` against the target DB |
| Auth redirect loop | Confirm Supabase URL + anon key match the project you're logged into |
| AI assistant silently fails | Check `OPENAI_API_KEY` and the `/api/ai/errors` route in devtools |
| Stale material snapshot warnings everywhere | That is expected behaviour after any ingredient-driving config change; see `src/lib/ingredients/snapshot.ts` for the stale lifecycle |

For anything else, `src/app/api/*/route.ts` logs errors to the server console
and `audit_logs` captures user-facing state transitions.

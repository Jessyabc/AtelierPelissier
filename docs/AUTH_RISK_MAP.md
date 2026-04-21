# API route risk map (auth hardening)

This document classifies `src/app/api/**/route.ts` handlers for authorization work.  
Legend: **Secrets** = exposes tokens/keys; **SideFX** = writes DB or triggers external systems.

## P0 — Block unauthenticated access immediately

| Route | Methods | Risk |
|-------|---------|------|
| `api/admin/config` | GET, PATCH | **Secrets** (integrations JSON), arbitrary config writes |
| `api/admin/errors` | GET, POST | Operational data leak / spam |
| `api/admin/errors/[id]/diagnose` | POST | AI spend + data leak |
| `api/ai/chat` | POST | Queues actions, DB writes to AI tables |
| `api/ai/conversations` | GET | Full conversation history leak |
| `api/ai/actions/[id]/approve` | POST | **SideFX** — executes arbitrary queued DB mutations |
| `api/integrations/monday/create-project` | POST | **SideFX** — creates projects + Monday calls |
| `api/integrations/monday/boards` | GET, POST | Admin; POST accepts in-body key for test-before-save |
| `api/integrations/monday/boards/[boardId]/items` | GET | Admin; uses stored Monday key |
| `api/integrations/sage/connect` | GET | OAuth initiation (should be logged-in admin) |

## P1 — Writes trusting client-supplied IDs (forgeable without auth)

| Area | Examples | Status |
|------|----------|--------|
| Time tracking | `api/time-punches`, `api/time-punches/[id]`, `api/time-punches/active` | Open |
| Service calls (project-scoped) | `api/projects/[id]/service-calls/**` | **Closed 2026-04-17** — now under `withProjectAuth` (admin/planner/salesperson) |
| Service calls (top-level) | `api/service-calls` | Open |
| Day plan / calendar | `api/day-plan`, `api/day-plan/[id]`, `api/calendar-events`, `api/calendar-events/[id]` | Open |
| Orders | `api/orders/**` | **Closed 2026-04-17** — all routes under `withAuth(["admin","planner"])`; receive endpoints explicitly called out as stock-moving |
| Inventory / ops | `api/inventory/**`, `api/ops/**`, `api/stock-movements` | Open |
| Projects | `api/projects/**` (mutations) | **Closed 2026-04-17** — `withAuth` / `withProjectAuth` across all 38 route files; see `src/lib/auth/guard.ts` |
| Employees / stations | `api/employees/**`, `api/work-stations/**` | Open |

## P2 — Reads (still sensitive for internal ops)

| Area | Notes |
|------|------|
| `api/export` | Full DB backup JSON |
| `api/dashboard`, `api/jobs`, `api/stats` | Aggregated business data |
| `api/clients`, `api/distributors`, `api/suppliers` | CRM data |

## Public exceptions (must stay unauthenticated for OAuth redirects)

| Route | Reason |
|-------|--------|
| `api/integrations/sage/callback` | OAuth redirect target from Sage |

## Mitigation strategy

1. **Middleware**: require Supabase session for `/admin`, `/onboarding`, `/api/admin`, `/api/ai`.
2. **Global API default**: all other `/api/*` routes call `requireSession()` unless explicitly public.
3. **Role checks**: `admin` for config + integrations; `planner` | `admin` for scheduling; `salesperson` for project-facing writes as needed.
4. **Unified guard (preferred contract for new + migrated routes):** `withAuth<P>(policy, handler)` and `withProjectAuth<P extends { id: string }>(policy, handler)` from `src/lib/auth/guard.ts`. `withProjectAuth` layers project-ownership enforcement on top of the role policy using a shared `checkProjectAccess(session, projectId)` that reuses the already-fetched session.

## Migration progress

- **2026-04-17:** `/api/projects/**` (38 routes) and `/api/orders/**` (5 routes) fully migrated onto `withAuth` / `withProjectAuth`. `requireRole` / `requireProjectAccess` call sites in those trees are gone.
- **Next up (AUTH-02):** `/api/admin/**`, `/api/inventory/**`, `/api/suppliers/**`, AI action trees, and the remaining top-level `api/service-calls`, `api/time-punches`, `api/day-plan`, `api/calendar-events`, `api/employees`, `api/work-stations`.

This map is a snapshot for the auth rollout; update as new routes are added.

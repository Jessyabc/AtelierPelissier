# Atelier Pelissier — Master Roadmap

**Single source of truth.** Replaces `IMPROVEMENTS.md` and `PHASE2.md` (both archived).  
Companion docs: `docs/OPERATIONS_MATURITY_ROADMAP.md` (scorecard), `docs/IMPLEMENTATION_BOARD.md` (ticket backlog), `docs/ADMIN_CUSTOMIZATION_SURFACE.md`, `docs/AUTH_RISK_MAP.md`, `docs/TEST_MATRIX_AUTH.md`. Anything under `docs/archive/` is history, not active work.

Last updated: 2026-04-17

> **What changed on 2026-04-17 (foundations — project lifecycle + sales-stage UI primitives):**
> - **Project lifecycle schema** — `Project` gained `archivedAt`, `archiveReason`, `lostReason`, and `lastSalesActivityAt`, plus two indexes (`archivedAt`, `[stage, lastSalesActivityAt]`). Migration `20260417230000_add_project_lifecycle_fields` backfills `lastSalesActivityAt` from `updatedAt` so nothing looks artificially stale on day one.
> - **Lifecycle business logic** (`src/lib/projectLifecycle.ts`) is the single source of truth for follow-up cadence, auto-archive, and sales-activity timestamps. Jest covers every predicate (`effectiveLastSalesActivity`, `isSalesFollowUpCandidate`, `shouldAutoArchive`, `getSalesFollowUpReason`, `thresholdsFromStandards`).
> - **Lifecycle API endpoints** — `POST /api/projects/[id]/lifecycle` (archive / unarchive / mark-lost / mark-found, all `withProjectAuth` + audit-logged) and `POST /api/admin/archive-stale-quotes` (admin/planner only, supports `dryRun` + `asOf`). `audit.ts` extended with `lifecycle_*` action kinds.
> - **Shared override UX primitives** (`src/components/standards/*`) — `overrideResolver.ts` (pure TS, Jest-covered) + `StandardsContext` + `OverrideRequestModal` + `ConstructionStandardField`. These are the reusable building blocks every future cabinetry builder (kitchen first) will lean on, and splitting the resolver from the JSX makes them easy to test in isolation.
> - **Admin surface for follow-up thresholds** — `ConstructionStandards` now stores `quoteFollowUpDays` + `invoiceFollowUpDays`, and the Admin Hub > Construction Standards tab got a new "Sales follow-up cadence" section so operators can tune the cadence without a deploy.
> - **Quote-stage UI polish** (makes later UI work cheap):
>   - `projects/[id]` Overview tab is stage-aware. On quote-stage projects, Materials + Profit stat cards are hidden, "Progress" becomes "Rooms configured", "Selling Price" becomes "Quoted price", and the process board is replaced with a flat "Rooms on this quote" list that deep-links into the Estimates tab. Material-shortage cards are suppressed pre-cutlist.
>   - Home filter chips switched from `all / quotes / drafts / saved / done` to the canonical taxonomy `all / quotes / invoices / active / done / archived`, all routed through `lib/projectStage.ts` predicates. Archived + lost are hidden from every chip except **Archived**.
>   - `DraftIntakePanel` now derives `stageView` once and swaps a whole copy dictionary — "Quote intake" vs "Invoice intake" vs legacy fallback — covering title, subtitle, reference-field label, readiness message, save button, and toast. Render gate widened from `isDraft` to `isPreDeposit || isDraft`.
> - **Quality gate** — `tsc --noEmit` + ESLint green on every touched file. Jest suites green.
>
> **Scorecard impact:** §13 Project lifecycle fidelity 3 → **3.5/5** (lifecycle fields + auto-archive path exist; cron wiring still pending). §17 Admin customization coherence 3.5 → **3.75/5** (follow-up cadence is now admin-tunable).
>
> **Flagged for next cycle:**
> - Wire `/api/admin/archive-stale-quotes` to a scheduler (Vercel Cron, nightly dry-run → live) as part of Week 6.
> - Surface `mark-lost` + `archive` controls on the project detail page (currently API-only).
> - Kitchen builder Stage 1 (Week 2) is now unblocked — all override primitives are in place.

> **What changed on 2026-04-17 (API auth migration cycle):**
> - **Unified `withAuth` / `withProjectAuth` rolled out across `/api/projects/**` and `/api/orders/**`** — every mutation route in both trees is now behind the same guard in `src/lib/auth/guard.ts`. No more ad-hoc `requireRole(...); if (!ok) return response` at the top of handlers, no more inline `requireProjectAccess` after a session fetch.
> - **New composite helper** `withProjectAuth<P extends { id: string }>(policy, handler)` — runs the role check via `withAuth`, then enforces project ownership through a shared `checkProjectAccess(session, projectId)` that reuses the already-fetched session (eliminates the double-fetch that plain `requireProjectAccess` had to do post-`withAuth`).
> - **`withAuth` now handles Next.js 15 `params: Promise<P>`** — it awaits internally so route handlers get a plain `params` object; `AuthedContext<P>` is the canonical handler signature.
> - **Latent bug fixed** — `/api/projects/[id]/material-snapshot` POST was calling `/api/projects/[id]/recalculate` via internal `fetch` without a cookie. Would have silently 401'd once recalculate was locked to admin/planner. Replaced with a direct `recalculateProjectState(projectId)` call.
> - **Quality gate** — `tsc --noEmit` and ESLint green across the 43 touched route files + `src/lib/auth/guard.ts`.
>
> **Scorecard impact:** §11 Roles and permissions 4 → **4.5/5**. Overall average 2.79 → **2.82/5**.
>
> **Flagged for next cycle:**
> - UI-AUTH-01: hide `SettingsTab` from salespeople (API is already locked to admin/planner).
> - AUTH-02: extend the same migration to `/api/admin/**`, `/api/inventory/**`, `/api/suppliers/**`, and the AI action trees. This is the remaining 0.5 to get §11 to 5/5.

> **What changed on 2026-04-16 (the "product builder + sales surface" cycle, phases 1-7):**
> - **Monday ingestion reliability** — board-name + job-number resolution (`resolveMondayBoardIdForAction`, `findMondayItemByRefInTree`), bilingual room inference in `guessRoomType` with diacritic normalisation.
> - **Warehouse sections** — new `WarehouseSection` model, `/api/warehouse-sections` CRUD, inventory UI with section filter + per-item location picker, AI tools (`listWarehouseSections`, `proposeCreateWarehouseSection`, `proposeSetInventoryLocation`).
> - **Invite / login UX** — invite links prefer `NEXT_PUBLIC_APP_URL`/request origin over `VERCEL_URL`, login page has show/hide + confirm-password for first-time signup.
> - **Room-first project wizard** — `/projects/new` persists a draft to `localStorage`, supports a quantity per room type (2 vanities → 2 `ProjectItem`s), auto-assigns the default process template via `resolveDefaultProcessTemplateId`, and deep-links into the product builder when buildable rooms were created. `targetDate` flows into `Project.targetDate` on create.
> - **Default process resolver** — `src/lib/processDefaults.ts` centralises vanity→Vanity, side_unit→Side Unit, kitchen→Kitchen with admin override (`AppConfig.processDefaults`) and a Kitchen fallback. Admin UI (`Admin → Room Types`) shows the effective fallback per row.
> - **Role-aware project detail** — Production tab removed, History admin/planner-only, sales get `Overview / Client & Info / Estimates & Costs / Service Calls` only. Sales `Estimates & Costs` renders `SalesProjectSummary` (panel / hinge / drawer-box totals + copy-pastable order description on invoiced/confirmed). Timeline is read-only for sales via `ProjectBoardCard.readOnly`.
> - **Vanity modular-box architecture** — per-section sides / bottom / front+back stretchers / back, plus two 3/4" outer finishing panels. Section backs and drawer-box bottoms now 5/8" melamine (no more 1/4" hardboard in vanity or side-unit builds). Edge banding computed per section as `2H + 2D + 2sectionW` summed. Sink sections mark their top drawer as U-shape and add cutout edge banding. 8" minimum section width is server-enforced only — the UI warns in amber but never clamps.
> - **Unified Save in product builder** — VanityTab and SideUnitTab collapse "Save inputs" + "Save materials" into a single Save that patches config and refreshes the material snapshot atomically. Shared `saveMaterialSnapshot` client helper; `IngredientEstimatePanel.hideInternalSave` lets parents drive the save.
> - **Planner order description** — when a project is `invoiced`/`confirmed`, the planner view of `Estimates & Costs` now shows the same copy-pastable `OrderDescriptionBlock` the salesperson sees, above the builder (builder itself stays fully editable).
> - **Role-aware `/today`** — `SalesTodayView` (active-project responsibilities + builder todos), `PlannerTodayView` (jobs grouped by project with blocking steps), `WoodworkerQueue` (existing per-employee queue) served from one `/api/today` payload.
> - **Process step durations** — `ProcessStep.estimatedMinutes` is now editable from the process builder UI (`/processes/[id]`), seeds `ProjectProcessStep.estimatedMinutes` at seeding time, and renders on the canvas node for a quick visual.
>
> **Scorecard impact:** §11 Roles and permissions 3 → 4/5 · §17 Admin customization coherence 3 → 3.5/5. Full detail in `docs/OPERATIONS_MATURITY_ROADMAP.md`.
>
> **Previous delta (2026-04-09 → 2026-04-14):**
> - Configuration-to-material-truth subsystem landed (ingredient engine, material snapshots, construction standards, section configurator).
> - Role-aware next-action spine (`getNextAction`) drives project cards and the project detail header.
> - PDF invoice drop-zone on New Project pre-fills the wizard via `parseInvoiceText` heuristics (pdf-parse → LlamaParse fallback).
> - Sales lifecycle stage (`Project.stage` = `quote` / `invoiced` / `confirmed`) added with wizard picker, list section, and role-branch routing in `getNextAction`.
> - VanityTab refactored to section-canonical layout.

---

## 1. What this app is

A full operations hub for a custom cabinetry shop: from first client conversation through final invoice reconciliation. One system, four roles, one source of truth.

**Tech stack:** Next.js 14.2 · React 18 · Tailwind · Prisma · PostgreSQL · Supabase Auth · OpenAI  
**Roles:** Admin · Planner · Salesperson · Woodworker

---

## 2. Real-world flow of events (how the app should work end-to-end)

```
1. SALES creates project (client info, type, rough scope, target date)
          ↓
2. PLANNING adds estimates, cost lines, materials, cut list, assigns process template
          ↓
3. SYSTEM auto-calculates: material requirements → inventory risks → order risks → deviations
          ↓
4. PLANNING / ADMIN places purchase orders, tracks expected delivery
          ↓
5. PLANNING assigns production steps to employees with estimated durations
          ↓  ← THIS ENTIRE STEP IS MISSING
6. WOODWORKERS see their task list for the day + week on a mobile-friendly view
          ↓
7. WOODWORKERS punch in/out per task at station QR codes
          ↓
8. SALES schedules service calls → TECH executes on-site with printable route sheet
          ↓
9. ADMIN reconciles vendor invoices → maps actual costs to projects
          ↓
10. ADMIN marks project Done → final margin and actual vs estimate visible
```

Step 5 is the single biggest gap in the system. Everything else has some implementation. Task distribution does not exist at all.

---

## 3. Current state by role

### SALESPERSON
**Can do:** Create/view/duplicate projects · Drop a PDF invoice on New Project to auto-pre-fill the wizard · Pick a sales lifecycle stage (quick quote / invoiced / confirmed) at creation · See role-specific next-action CTAs and a dedicated "Quick quotes & invoices" list section · Schedule service calls · View calendar · View costing/distributors

| Gap | Priority |
|-----|----------|
| No PDF quote / printable estimate to send to a client | CRITICAL |
| "My Projects" filter is partial — role-aware list exists but no explicit salesperson filter tab | MEDIUM (was HIGH) |
| Service call form too complex for field use on a phone | HIGH |
| VanityTab still desktop-first — mobile step-by-step view not built | MEDIUM |
| No print-ready service call form for on-site paper copies | MEDIUM |
| No wizard when duplicating a project to adapt old costs | LOW |

---

### PLANNER
**Can do:** Full project detail · Inventory with shortage alerts · Purchase orders · Deviation dashboard · Process templates · Calendar management · Live ingredient estimate + saved material snapshot per vanity/side-unit with stale tracking · Stage-aware next-action (quote/invoiced projects are visibly gated as "waiting on sales" / "waiting on deposit")

| Gap | Priority |
|-----|----------|
| No task assignment system — cannot say "Vital does step 3, est. 45 min" | CRITICAL |
| No connection between process steps and calendar dates | CRITICAL |
| `/purchasing` page is a stub that redirects to distributors | HIGH |
| Recalculation errors are swallowed silently (fire-and-forget, no surfacing) | HIGH |
| Process template assigned to project but progress not tracked per project | HIGH |
| No bulk receive on orders (must receive each line one by one) | MEDIUM |
| No sorting/grouping on the main project list | MEDIUM |
| No real-time sync (two planners editing = silent conflicts) | MEDIUM |
| Inventory availability may miscount when order states are mixed | MEDIUM |

---

### ADMIN
**Can do:** Everything — full CRUD, employee management, time punches, vendor invoice mapping, risk thresholds, error logs, impersonation, audit log

| Gap | Priority |
|-----|----------|
| API endpoints don't universally enforce role checks (pages gated, API calls not) | HIGH (security) |
| No email sending (templates exist in admin config but nothing sends) | MEDIUM |
| Vendor invoice PDF parsing is manual (upload works, content not extracted) | MEDIUM |
| No alerting on deviations (email/Slack when margin drops or shipment late) | MEDIUM |
| Cascade deletes missing on some models (Deviation, AuditLog) — orphaned records | LOW |
| No rate limiting / CORS protection | HIGH (before public deploy) |
| Sage integration started but incomplete | LOW (Phase 3) |

---

### WOODWORKER
**Can do:** View calendar · AI chat assistant · Punch in/out at station QR codes

| Gap | Priority |
|-----|----------|
| No task list — only window into business is the calendar (no context for why) | CRITICAL |
| No mobile-optimized view — app is desktop-first, shop floor uses phones | CRITICAL |
| Punch in/out not linked from the woodworker UI (it's at /punch/[station] via QR only) | MEDIUM |
| Cannot view checklist items for assigned tasks | MEDIUM |

---

### CROSS-ROLE
| Gap | Priority |
|-----|----------|
| Calendar completely disconnected from the project engine (no targetDate → calendar, no deviation warnings on calendar, no step scheduling) | CRITICAL |
| Field-level error messages missing — "Validation failed" with no field details | MEDIUM |
| No loading skeletons (blank state while data loads) | LOW |
| No mobile-responsive layout on most pages | HIGH |

---

## 4. The two disconnected islands problem

The **calendar** and the **project engine** do not talk to each other.

- The observability engine (recalculate → deviations → cockpit) runs on project changes
- The calendar shows service calls by `serviceDate` and manual one-off events
- A project's `targetDate` never appears on the calendar
- A process template's steps are never anchored to calendar dates
- A woodworker's punch clock is never informed by a pre-assigned task

**Fix requires three schema additions:**

```
ProcessStep  +  estimatedMinutes          (e.g. 45)
             +  defaultEmployeeRole        (e.g. "woodworker")

ProjectProcessStep  (project-specific instance of a template step)
             +  projectId
             +  stepId
             +  assignedEmployeeId
             +  scheduledDate
             +  estimatedMinutes           (copied from template, editable)
             +  actualMinutes              (filled from TimePunches)
             +  status                     (pending / in_progress / done)
```

Once `ProjectProcessStep` exists:
- Calendar shows "Vital: step 3 of MC-6199 (est. 45 min)"
- Cockpit warns when target delivery date is unreachable given assigned steps
- Woodworker sees a "Today" task list instead of a blank calendar
- Actual punch durations feed back into baseline estimates over time

---

## 5. Prioritized execution plan

### Tier 1 — Must fix before the app is truly useful for everyone

| # | What | Who it unblocks | Effort |
|---|------|----------------|--------|
| 1 | PDF quote export (print-only view + window.print or jsPDF) | Salesperson delivers estimates to clients | M |
| 2 | Role checks on all API endpoints | Security foundation | M |
| 3 | Surface recalculation errors (wrap fire-and-forget, log + show badge) | Planner trusts numbers | S |
| 4 | `ProjectProcessStep` schema + assignment UI | Entire task distribution system | L |
| 5 | Woodworker "Today" view (task list + punch-in button, mobile-first) | Woodworker uses the app | L |
| 6 | Calendar ↔ project engine connection (targetDate → calendar, step → calendar slot) | Everyone sees one timeline | L |

---

### Tier 2 — Should fix for the app to feel complete

| # | What | Who it unblocks | Effort |
|---|------|----------------|--------|
| 7 | `/purchasing` dedicated page (order workflow, search, filter, status) | Planner's purchasing workflow | M |
| 8 | Process progress tracking per project (% complete, current step) | Planner, Admin | M |
| 9 | Salesperson "My Projects" filtered view | Salesperson focus | S |
| 10 | Mobile-responsive layout across all pages | Woodworker, Salesperson on-site | L |
| 11 | Field-level error messages on all forms | All roles | M |
| 12 | Deviation alerting (email when margin risk or shortage fires) | Admin, Planner proactive | M |
| 13 | Bulk order receiving | Planner efficiency | M |
| 14 | Loading skeletons across all pages | All roles, UX polish | S |

---

### Tier 3 — Phase 3 / nice to have

| # | What | Notes |
|---|------|-------|
| 15 | Email sending from within the app (quotes, service call follow-ups) | Requires email service integration |
| 16 | Invoice PDF auto-parsing (upload → extract → map) | Requires LlamaParse or similar |
| 17 | Capacity planning ("Vital is booked 6h tomorrow, don't assign more") | Requires Tier 1 task system first |
| 18 | Profitability forecasting | Requires clean time baselines (6+ months of data) |
| 19 | Sage integration (financial reconciliation) | Already started, incomplete |
| 20 | Real-time sync (WebSockets for multi-user) | Nice for collaborative editing |
| 21 | French / English toggle | Brand alignment for Quebec market |
| 22 | Dark mode | Quality of life |
| 23 | Commercialization readiness (generalize for other shops) | Only after internal maturity proven |

---

## 6. What is already built (do not rebuild)

The following Phase 2 features from the old PHASE2.md are **fully implemented**:

- Inventory (onHand / reserved / available / incoming, reorder thresholds, stock movements)
- Purchase orders (create, place, receive per line, deviation on delay)
- Vendor invoices (create, map lines to projects/categories)
- Observability engine (recalculateProjectState → financial → material → inventory → order risk)
- Deviation system (margin_risk, cost_overrun, inventory_shortage, order_delay, timeline_risk)
- QR station punch system (/punch/[station] — clock in/out per employee per project)
- Process templates (visual flowchart builder — labels only, no durations yet)
- Supabase auth + custom role mapping
- AI assistant + action approval flow
- Audit log per project
- Error boundaries + toast notifications
- Delete project (with confirmation)
- Duplicate project

Added since the 2026-04-09 review:

- **Ingredient engine + material snapshot subsystem** (`src/lib/ingredients/`) — section-canonical layout, construction standards singleton, live estimate vs saved snapshot with stale tracking, panel/hardware/sheet counts, config warnings
- **Section configurator UI** + SVG wireframe preview for vanity and side-unit tabs
- **Role-aware next-action spine** (`src/lib/workflow/nextAction.ts`) driving project cards, the project detail header CTA, and role-filtered list copy
- **PDF invoice intake** — drop-zone on New Project, heuristic field extraction via `parseInvoiceText`, pdf-parse → LlamaParse OCR fallback
- **Sales lifecycle stage** on `Project` (`quote` / `invoiced` / `confirmed`) with wizard step 0 picker, dedicated list section, planner/salesperson stage gates in `getNextAction`
- **VanityTab section-canonical refactor** — legacy flat doors/drawers inputs removed, implicit section synthesised for existing projects, vanity width rescales sections, sinks consolidated when a countertop is present, countertop width/depth default to `vanity + 0.5"` overhang with "Match vanity" reset

These are done. The gaps listed in Tier 1–3 above are what remains.

---

## 7. Files this document supersedes

| File | Status |
|------|--------|
| `IMPROVEMENTS.md` | Superseded — all items either done or moved to Tier 1/2/3 above |
| `PHASE2.md` | Superseded — Phase 2 features are fully implemented |
| `docs/PHASE_1_OPERATIONAL_MATURITY_PLAN.md` | Active — detailed workstream specs for operational hardening (WS-1 through WS-8) still valid, refer for implementation detail |
| `docs/PHASE_2_LEAN_REFACTOR_PLAN.md` | Active — lean refactor plan, execute only after 4 weeks of Phase 1 usage data |
| `docs/IMPLEMENTATION_BOARD.md` | Active — 42 Phase 1 tickets + 18 Phase 2 tickets, use for sprint planning |
| `docs/OPERATIONS_MATURITY_ROADMAP.md` | Active — maturity scorecard, updated with current scores |

---

## 8. Dependency order for Tier 1

```
API role checks (2)              ← independent, do first
Recalc error surfacing (3)       ← independent, quick win
PDF quote (1)                    ← independent, salesperson unlock
                                       ↓
ProjectProcessStep schema (4)    ← prerequisite for 5 and 6
       ↓                                  ↓
Woodworker Today view (5)     Calendar ↔ engine (6)
```

Start 1, 2, 3 in parallel. Then 4 unlocks 5 and 6.

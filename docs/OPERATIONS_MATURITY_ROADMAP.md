# Operations Maturity Roadmap — Scorecard

**Single source of truth for maturity scoring and the "where are we actually" question. This is the north-star scorecard — the doc we re-read every cycle to decide what to invest in next.**

## North Star

**What this app is (one line):** the operating system of a custom cabinetry shop — the single place where a project goes from salesperson conversation → invoice → shop floor → delivered → serviced, with every cost, punch, cutlist, purchase order, and exception attached to the same Project row.

**Who uses it, and why:**

| Role | Daily win |
|---|---|
| Salesperson | Turn a conversation into a confirmed project without having to think about production; quote vanities/side units/kitchens from a guided builder; see what clients still owe a deposit or a missing field. |
| Planner | See every open job and know the next blocking step for each; hand work to the right woodworker; never be surprised by a missing material on a Monday morning. |
| Woodworker | Open `/today` on a phone, see *my* tasks grouped by project + urgency, punch in/out, done. |
| Admin / Owner | See the health of the whole shop in 30 seconds; tune defaults (processes, room types, kitchen pricing, permissions) without touching code. |

**End state we are heading towards (target maturity = 4.5+/5 overall):**

1. **Every project has a single truth.** Cost, cutlist, inventory, punches, and service calls attach to one Project row, and any change re-derives the downstream picture automatically (`recalculateProjectState` covers everything a human would have to remember otherwise).
2. **Role surfaces are tight.** Sales, planner, woodworker, admin each see the minimum they need and cannot accidentally break adjacent roles' flows.
3. **Hand-offs are explicit, not implicit.** Every stage transition (quote → invoiced → confirmed → in-production → done → delivered) is machine-readable, blockable, and auditable. The system refuses to advance when required fields are missing.
4. **Time and materials are measured, not estimated.** Punches are tagged to the specific `ProjectProcessStep` the employee is on. Cutlist feeds into material requirements, which feed into purchase orders, which feed back into inventory — all without a human nudging each step.
5. **Customization without code.** Everything that varies by shop (process templates, room-type → process mapping, kitchen pricing coefficients, inventory sections, permissions) lives in admin-editable config. The codebase is the platform; each shop is data.
6. **Commercially portable.** Another shop could pick up this system and be productive in a week, because the data model and the vocabulary are generic — shop-specific vocabulary lives in seeds, not in code.

**How to read the rest of this file:** every section below scores where we are *today* against that end state. Sections scoring under 3 are the active bottleneck. The "Top 3 actions before next review" block at the bottom is the short list we commit to moving before the next cycle.

---

## Where each thing lives

- Live cycle deltas + strategy: [`/ROADMAP.md`](../ROADMAP.md) (master)
- This scorecard (scores, per-section actions, running state): you are here
- Ticketed backlog with cycle-closure log: [`docs/IMPLEMENTATION_BOARD.md`](./IMPLEMENTATION_BOARD.md)
- Reference docs (stable, rarely updated): `docs/ADMIN_CUSTOMIZATION_SURFACE.md`, `docs/AUTH_RISK_MAP.md`, `docs/TEST_MATRIX_AUTH.md`
- Historical plans: [`docs/archive/`](./archive/) — kept for context, not active work

Convention: we do **not** add a new `NEXT_STEPS_<date>.md` per cycle. Each cycle updates the delta block in `ROADMAP.md`, the scores here, and the closure log in `IMPLEMENTATION_BOARD.md`.

Last updated: 2026-04-16 (product-builder & role surface cycle)

> **Delta since 2026-04-16 (product builder + sales surface cycle):**
> - **Room-first wizard** — `/projects/new` persists a draft to `localStorage`, lets the salesperson pick a quantity per room (e.g. 2 vanities), auto-assigns the default process template server-side via `resolveDefaultProcessTemplateId`, and deep-links into the product builder on submit when buildable rooms were created.
> - **Default process resolver** — `src/lib/processDefaults.ts` centralises the vanity / side-unit / kitchen mapping with admin override (`AppConfig.processDefaults`) and a Kitchen fallback. `POST /api/projects/[id]/project-items` honours it transparently when `useDefaultProcess` is true.
> - **Admin customization surface** — `admin → Room Types` shows the built-in fallback per row so admins understand what happens when the override is empty. Custom room types already flow into the wizard; they now also participate in the resolver.
> - **Role-tailored project detail** — `Production` tab removed (oversight moved into Overview), `History` is admin/planner-only, sales see `Overview / Client & Info / Estimates & Costs / Service Calls` only. Sales `Estimates & Costs` renders `SalesProjectSummary` (panel / hinge / drawer-box totals + copy-pastable order description on invoiced/confirmed).
> - **Read-only timeline for sales** — `ProjectBoardCard` supports `readOnly`; sales cannot reorder, add, or complete steps, but planners/admins keep full control.
> - **Vanity modular-box architecture** — `computeVanityIngredients` now emits per-section sides / bottom / front+back stretchers / back, plus two 3/4" finishing panels outside the section span. Back panels are 5/8" melamine. Edge banding is computed per section as `2H + 2D + 2sectionW` summed. Sections above a sink mark their top drawer U-shape. The 8" minimum section width is enforced server-side only (input UI shows a warning but no longer clamps).
> - **Unified Save in product builder** — VanityTab and SideUnitTab collapse the old "Save inputs" + "Save materials" buttons into a single **Save** that patches the config and refreshes the material snapshot atomically. `IngredientEstimatePanel` exposes `hideInternalSave` for parent-driven flows.
> - **Planner order description** — when a project is `invoiced` / `confirmed`, the planner view of `Estimates & Costs` now shows the same copy-pastable order description block the salesperson sees, above the builder (reusable `OrderDescriptionBlock`).
> - **Role-aware `/today`** — the page now renders `SalesTodayView`, `PlannerTodayView`, and `WoodworkerQueue` from the same API payload. Sales see active-project responsibilities and builder todos; planners see jobs grouped by project with blocking steps highlighted; woodworkers keep their personal queue.
> - **Warehouse sections** — `WarehouseSection` model + `/api/warehouse-sections` + inventory UI let users (and the AI via `listWarehouseSections` / `proposeSetInventoryLocation`) tag inventory items to physical warehouse locations.
> - **Invite / login UX** — invite links prefer `NEXT_PUBLIC_APP_URL` / request origin over `VERCEL_URL`, and the login page now has a proper show/hide password + confirm-password experience for first-time signup.
> - **Bilingual Monday inference** — `guessRoomType` normalises diacritics and understands the French + English synonyms seen on the real Wood Shop board (`vanité`, `meuble lavabo`, `îlot`, `penderie`, `unité au-dessus de la laveuse sécheuse`, …). AI Monday actions also resolve board names (`"Wood Shop"`) and job numbers (`MC-xxxx`) before executing.
>
> **Delta since 2026-04-15 AM review:**
> - **Single master menu** — `src/config/menu.ts` is now the canonical definition. `AppHeader` and `roles.ts` both delegate to it. Every role sees the same menu *shape* with item-level visibility rules, not a separate menu tree per role.
> - **Permanent admin guard** — `jessy@evos.ca` is pinned as admin at `resolveDbUser()`. Role drift or invite mix-ups cannot strip ownership. Additional permanent owners can be added via the `APP_OWNER_EMAILS` env var without touching code.
> - **`withAuth` + `requireProjectAccess`** — new unified API guard in `src/lib/auth/guard.ts`. Replaces the copy-pasted `requireRole(...); if (!ok) return response` pattern and gives us one place to add logging, rate limiting, project-scope checks. Routes will be migrated incrementally; `api/admin/invites` and all `/api/admin/**` already gated.
> - **Invite flow verified end-to-end** — admin hub → `/admin/invites` → `POST /api/admin/invites` → share link → `login?invite=<token>` → `resolveDbUser` consumes the invite row and sets role. No orphaned code paths.
>
> **Delta from earlier 2026-04-15 cycles:** normalized kitchen pricing builder (schema + APIs + role-aware submit/approve path), Kitchen estimator moved from raw cost-lines to structured builder flow, admin behavior controls consolidated into Admin Hub (`/admin?tab=behavior`) with `/settings/risk` redirected there.

---

## How to use this scorecard

1. Score every section 0–5 using the scale below.
2. Add 1–3 concrete actions per section scoring below 4.
3. Assign an owner and target date.
4. Re-score at each review cycle.

## Scoring scale

| Score | Meaning |
|-------|---------|
| 0 | Not defined — does not exist anywhere |
| 1 | Defined in someone's head only |
| 2 | Partly in the system — incomplete or not enforced |
| 3 | Works manually — functional but relies on people following convention |
| 4 | Works reliably in the system — enforced and consistent |
| 5 | Works reliably and the full team uses it daily |

---

## Priority 5 (must win first)

1. Do we know the exact standard stages of a normal project?
2. Do we know the minimum information required before production can start?
3. Can the system match invoices/docs to the correct project reliably?
4. Can the team update work status simply without friction?
5. Can we see blocked projects, missing materials, and next actions instantly?

---

## 1. Core operational foundation

Checklist:
- Main project types clearly defined ✓
- Standard stages exist for each project type — visual template exists, but no duration or owner per step
- **Sales lifecycle stage exists ✓ (Project.stage = quote/invoiced/confirmed)** — drives salesperson next-action path and list grouping
- Stage ownership explicit by role/person — NOT DONE
- "Done" criteria exist for each stage — NOT DONE
- Stage mandatory/optional is machine-readable — NOT DONE

**Score: 2.5 / 5** (was 2; sales stage lifecycle raised it)  
**Owner:** Admin + Planner  
**Actions:**
- Define canonical stage owner + estimated duration per step in ProcessTemplate schema (add `estimatedMinutes`, `defaultEmployeeRole` fields)
- Add `ProjectProcessStep` model to track per-project step status (pending/in_progress/done)
- Document done criteria per stage in a single SOP

---

## 2. Project intake standardization

Checklist:
- Minimum intake info set defined ✓ (readiness check exists in `src/lib/readiness.ts`)
- Unique project identity rule exists ✓ (jobNumber field)
- Duplicate client name handling — partial
- Revised orders / change-after-sale process — NOT DONE
- Incomplete intake flag exists ✓ — but does not hard-block progression yet

**Score: 3 / 5**  
**Owner:** Sales + Admin  
**Actions:**
- Enforce readiness gate as hard blocker in `PATCH /api/projects/[id]` (currently advisory only — see P1-002 in IMPLEMENTATION_BOARD)
- Add duplicate-handling SOP for same-client revised sale cases
- Add change-order state to projects (mid-production change tracking)

---

## 3. Sales-to-production handoff

Checklist:
- **Clear handoff moment exists ✓ (Project.stage = confirmed, deposit timestamp, next-action flips from "Confirm deposit" → "Hand off to shop")**
- **Planner sees explicit "Waiting on sales" / "Waiting on deposit" gates before touching the project** ✓
- Required data for production start explicit — readiness check defined but not enforced at the API
- Product descriptions standardized enough for machine interpretation — partial
- Missing measurements/materials/finishes flagged — partial (deviation engine + ingredient warnings catch some)
- System can block progression on missing required fields — NOT ENFORCED

**Score: 3 / 5** (was 2; explicit stage handoff + planner gating raised it)  
**Owner:** Sales + Planner  
**Actions:**
- Enforce readiness gate hard block (P1-002) — stage=confirmed is a soft gate, readiness should be the hard one
- Surface stage transitions on the audit log so the handoff moment is reviewable
- Enforce blocker before production start when required handoff fields absent

---

## 4. Email and document ingestion

Checklist:
- Relevant email detection — NOT IMPLEMENTED
- Invoice PDF/confirmation identification — manual upload only (drop-zone on New Project)
- **Parser extracts client/amount/date/invoice # heuristically ✓** (`parseInvoiceText`, pdf-parse → LlamaParse fallback) — does not extract line items yet
- **Parsed docs pre-fill the wizard ✓** — human confirms before save (effectively a confidence=human gate)
- Parsed docs linked to projects with confidence thresholds — NOT IMPLEMENTED (no auto-match to existing project)
- Duplicate protection — NOT IMPLEMENTED

**Score: 2 / 5** (was 1; PDF drop-zone + heuristic pre-fill raised it)  
**Owner:** Admin  
**Actions:**
- Design ingestion pipeline states: received → parsed → matched → needs_review → applied
- Add confidence scoring + human approval for low confidence
- Add dedupe keys (file hash, invoice number + supplier + date) before any auto-action
- See P1-E5 in IMPLEMENTATION_BOARD for full spec

---

## 5. Project matching logic

Checklist:
- Ranking logic for incoming-to-project matching — NOT IMPLEMENTED
- Invoice/project number outranks client name — NOT IMPLEMENTED
- Same-client multi-project ambiguity handled — NOT IMPLEMENTED
- Multi-room/subproject matching handled — NOT IMPLEMENTED

**Score: 2 / 5**  
**Owner:** Admin + Planner  
**Actions:**
- Implement weighted ranker (job/invoice > address > client > fuzzy name)
- Add mandatory disambiguation prompt when top match confidence is below threshold
- Add subproject/room-level matching metadata

---

## 6. Production workflow structure

Checklist:
- Workflow reflects real shop stages ✓ (process templates exist)
- Projects can move forward/backward — forward only, no structured backward
- Holds/blocks are explicit — `blockedReason` field exists on Project ✓
- Active vs blocked vs completed distinction — partial (isDraft/isDone + blockedReason exist, not yet surfaced as first-class dashboard filters)
- **Task assignment to employees per step ✓** (`ProjectProcessStep` model + `ProductionTab.tsx` inline editor to set `assignedEmployeeId` and `scheduledDate` per row)
- **Step duration estimates ✓** (`estimatedMinutes` on both `ProcessStep` and `ProjectProcessStep`)
- **Daily task list per employee ✓** (`/today` page + `/api/today` return today / week / overdue buckets)
- **Calendar renders assigned steps ✓** (`/api/calendar` merges `serviceCall + manualEvent + projectProcessStep`, `calendar/page.tsx` renders type="process_step")

**Score: 3.5 / 5** (↑ from 2 — the previous audit was wrong: the full `ProjectProcessStep` pipeline is built from schema → API → planner assignment UI → woodworker Today view → calendar. Remaining gap is reporting: active vs blocked vs completed dashboard grouping, and backwards step moves.)  
**Owner:** Planner  
**Actions:**
- Surface blocked vs active vs done as first-class dashboard grouping
- Add "revert to pending" for woodworkers marking a step done by mistake
- Add on-schedule / late indicator derived from `estimatedMinutes` vs actual punch duration

---

## 7. QR station timing system

Checklist:
- Each station has a clear purpose in the data model ✓ (WorkStation with slug/location)
- Start/stop/switch task UX is simple ✓ (punch kiosk at /punch/[station])
- Time data quality can be evaluated — NOT DONE (no anomaly detection)
- Reporting intent clear — partial (TimePunch records exist, no reporting UI)
- Tracking scope focuses on what improves estimate/schedule/pricing — NOT YET (no baseline computation)

**Score: 3 / 5**  
**Owner:** Shop Lead  
**Actions:**
- Define allowed punch categories and invalid/noisy patterns
- Add daily anomaly report (long open punch, missing station, rapid toggles)
- Define KPI set used for pricing/estimation updates

---

## 8. Standard time baselines

Checklist:
- Top 10–20 repeatable tasks defined — NOT DONE
- Timing collection consistent — partially (punches are collected but not task-tagged)
- Average/range/outlier logic exists — NOT DONE
- Standard jobs separated from custom exceptions — NOT DONE
- Task templates from historical timing — NOT DONE

**Score: 1 / 5** (↑ from 0 — `ProjectProcessStep` is built so punch data CAN now be task-tagged; next step is actually wiring the punch kiosk to the assigned step)  
**Owner:** Planner + Admin  
**Actions:**
- Wire `/punch/[station]` to auto-pick the currently-in-progress `ProjectProcessStep` for the scanning employee (so punches tag a task, not just a station)
- Define first 10 repeatable tasks and map to stations/project types
- Add `/api/reports/time-baselines` endpoint (avg/p50/p90/outlier per task per project type)
- Tag custom exception jobs so they don't pollute baselines

---

## 9. Inventory and purchasing logic

Checklist:
- Inventory naming and units standardized ✓
- Sheet size/cost/supplier metadata structured ✓
- Stable supplier mappings encoded ✓
- Order suggestions from cutlist + stock ✓ (via AI + deviation engine)
- Uncertainty surfaced ✓ (deviation system)
- Supplier/product mapping can be learned — partial
- **Warehouse sections + location notes per item ✓** (`WarehouseSection` model, `/api/warehouse-sections`, inventory UI column, AI actions `listWarehouseSections` / `proposeSetInventoryLocation`)

**Score: 4.5 / 5** (↑ from 4 — warehouse sections close the "I don't know where in the warehouse this is" gap)  
**Owner:** Purchasing + Admin  
**Actions:**
- Add confidence labels for supplier default resolution
- Add confirmation loop to learn new supplier mappings
- Add weekly catalog hygiene report (missing units/costs/thresholds)

---

## 10. Cutlist integration

Checklist:
- Project state can be "waiting for cutlist" — partial (blockedReason can be set)
- Cutlist receipt detectable — manual only
- Cutlist linked to correct project — manual
- Material requirements derived from cutlist ✓ (PanelParts → MaterialRequirements)
- Next step auto-triggered or approval-triggered — NOT DONE

**Score: 3 / 5**  
**Owner:** Planner  
**Actions:**
- Add explicit "waiting for cutlist" status at project/subproject level
- Add confidence + confirmation for cutlist-to-project linking
- Add next-step trigger rules after cutlist received (requirements recalculation + purchasing suggestion)

---

## 11. Roles and permissions

Checklist:
- Role-specific interfaces simplified ✓ (project detail tabs per role; sales gets `Overview / Client & Info / Estimates & Costs / Service Calls` only; Production removed; History admin/planner-only)
- Woodworkers see only what they need ✓ (woodworker `/today` queue)
- Planner/ops role manages flow without admin clutter ✓ (`/today` planner view groups jobs by project + blocking step)
- Owner/executive view fast — NOT DONE
- Sales enters data without breaking production logic ✓ (sales read-only timeline + `SalesProjectSummary` hides costs/cutlists)
- Admin can override safely with audit visibility ✓

**Score: 4 / 5** (↑ from 3 — sales/planner/woodworker each have a tailored surface, project detail is now role-filtered, and the timeline is read-only for sales; executive summary remains the only major gap)  
**Owner:** Admin  
**Actions:**
- ~~Build woodworker "Today" view~~ ✓ DONE
- ~~Build salesperson "My Day" view~~ ✓ DONE (`SalesTodayView` in `/today`)
- ~~Role-aware project detail tabs + read-only timeline for sales~~ ✓ DONE
- Build owner/executive 30-second summary (ties back to Section 13)
- Migrate remaining `/api/projects/**` and `/api/orders/**` mutation routes to `withAuth` + `requireProjectAccess` (AUTH_RISK_MAP P1 closure)

---

## 12. AI action system

Checklist:
- Create/suggest project from email/invoice — NOT IMPLEMENTED (no ingestion)
- Match incoming document to project — NOT IMPLEMENTED
- Flag missing information ✓
- Update project status ✓
- Suggest material orders ✓
- Draft supplier email — NOT IMPLEMENTED
- Answer project status quickly ✓
- Show blocked/overdue/stalled projects ✓
- **Monday.com ingestion with bilingual room inference ✓** (`guessRoomType` handles FR + EN synonyms; AI resolves board names and job numbers before executing)
- **Warehouse-location actions ✓** (`listWarehouseSections`, `proposeCreateWarehouseSection`, `proposeSetInventoryLocation`)

**Score: 3.5 / 5** (↑ from 3 — Monday ingestion works on the real Wood Shop board and the AI can now reason about physical warehouse locations)  
**Owner:** Admin + Planner  
**Actions:**
- Add doc-to-project match action (depends on ingestion pipeline — Section 4)
- Add missing-info flagging action
- Add blocked/overdue summary action
- Add action-level risk classes + approval policy by role

---

## 13. Dashboard usefulness

Checklist:
- Active projects visible instantly ✓
- **Pre-deposit pipeline visible ✓** (Quick quotes & invoices section on home list)
- **Role-aware project cards ✓** (stage badge, next-action CTA per role via `getNextAction`)
- Blocked projects visible — partial (deviations shown but not grouped by blocked)
- Current assignee/woodworker focus visible — NOT DONE (no task assignments exist)
- Waiting-on-material list visible ✓ (home cockpit shortage feed)
- "Needs ordering today" visible ✓ (cockpit)
- Executive status in 30 seconds — NOT DONE

**Score: 3 / 5** (stage grouping + role-aware cards improved daily usefulness without crossing the 4 threshold — still no task focus or executive summary)  
**Owner:** Owner + Planner  
**Actions:**
- Add executive mode: 30-second summary cards at top (active, blocked, ordering-needed, overdue)
- Group projects by blocked vs active vs done in default cockpit view
- Add per-role dashboard presets
- Add "last updated" timestamp for data freshness

---

## 14. Exception handling

Checklist:
- Missing info path explicit — partial (deviation exists, no exception queue)
- Parser uncertainty path explicit — NOT DONE
- Inconsistent product description handling — NOT DONE
- Weird supplier formatting fallback — NOT DONE
- Sales omissions recoverable — partial
- Mid-production change handling — NOT DONE

**Score: 2 / 5**  
**Owner:** Admin + Planner  
**Actions:**
- Add explicit exception states and queues (needs_info, low_confidence, changed_after_start)
- Add recovery playbooks for top 5 exception types
- Add owner + SLA per exception category
- See P1-E6 in IMPLEMENTATION_BOARD for full spec

---

## 15. Training and adoption

Checklist:
- New employee onboarding < 15 min for role-specific tasks — NOT DONE
- Woodworker workflow self-serve — NOT DONE (no task view)
- Planner workflow independent — partial
- Error recovery path obvious and low-stress — NOT DONE
- One non-negotiable data entry rule clear to everyone — NOT DONE

**Score: 1 / 5**  
**Owner:** Admin  
**Actions:**
- Create one-page SOP per role: 3 core tasks + 3 common mistakes
- Define and publish one non-negotiable data entry rule
- Run 2-week adoption check with direct team feedback after role UI is simplified

---

## 16. Commercialization readiness

Checklist:
- System does not depend on one person's memory — NOT YET
- Another shop could understand workflows without custom explanation — NOT YET
- Terms/statuses/logic are generalizable — partially
- Internal assumptions documented and replaceable — NOT YET

**Score: 1 / 5**  
**Owner:** Admin (future product owner)  
**Actions:**
- Start glossary + canonical status dictionary
- Separate shop-specific assumptions from platform logic in docs/config
- Identify 3 workflows to generalize first for external portability
- Do not prioritize until internal maturity is at 4+ across all critical sections

---

## 17. Admin customization coherence

Checklist:
- Admin-level behavior controls in one canonical place ✓ (Admin Hub → App Behavior, Room Types, Menu, Integrations)
- Legacy scattered settings entry points reduced — partial (`/settings/risk` now redirects to Admin Hub behavior tab)
- Clear inventory of customizable surfaces — DONE (`docs/ADMIN_CUSTOMIZATION_SURFACE.md`)
- Room type → process template mapping is admin-editable ✓ (`AppConfig.processDefaults` surfaced in `Admin → Room Types`, with built-in fallback indicator)
- Custom room types plumbed through wizard + resolver ✓
- Process step durations editable from the process builder ✓ (`estimatedMinutes` on `ProcessStep` + builder UI + persistence)
- Kitchen pricing admin controls persisted and editable from UI — NOT DONE (currently code constants; persistence/config editor pending)

**Score: 3.5 / 5** (↑ from 3 — process-template mapping and step durations are now fully configurable by admins without touching code; fallback behaviour is visible in-UI)  
**Owner:** Admin  
**Actions:**
- Persist kitchen pricing coefficients in admin config tables (manufacturer/style/hardware/labor/install/delivery presets)
- Add behavior-change audit timeline for admin settings updates
- Keep new customization features routed through `/admin` tabs only
- Document the `processDefaults` fallback logic in `ADMIN_CUSTOMIZATION_SURFACE.md`

---

## Current snapshot

| Section | Score | Delta vs last |
|---------|-------|--------------|
| 1. Core operational foundation | 2.5 | — (still missing canonical done-criteria + stage ownership) |
| 2. Project intake | 3 | — |
| 3. Sales-to-production handoff | 3 | — (readiness hard-block still pending) |
| 4. Email/document ingestion | 2 | — |
| 5. Project matching | 2 | — |
| 6. Production workflow + task distribution | 3.5 | — |
| 7. QR station timing | 3 | — |
| 8. Standard time baselines | 1 | — (waiting on punch↔step tagging) |
| 9. Inventory + purchasing | **4.5** | ↑ from 4 (warehouse sections + location notes now first-class, AI-editable) |
| 10. Cutlist integration | 3 | — |
| 11. Roles and permissions | **4** | ↑ from 3 (sales/planner/woodworker each have a tailored `/today` + role-filtered project detail + read-only timeline for sales) |
| 12. AI action system | **3.5** | ↑ from 3 (Monday ingestion + warehouse-section actions + bilingual inference) |
| 13. Dashboard usefulness | 3 | — |
| 14. Exception handling | 2 | — |
| 15. Training and adoption | 1 | — |
| 16. Commercialization readiness | 1 | — |
| 17. Admin customization coherence | **3.5** | ↑ from 3 (process defaults + editable step durations, both admin-configurable without code) |
| **Overall average** | **2.79 / 5** | ↑ 0.19 (roles, AI, inventory, admin customization all ticked up this cycle) |

**Review date:** 2026-04-16  
**Top 3 risks this cycle:**
1. **API role enforcement is still partial.** ~60 routes rely on the middleware session but don't check role or project ownership. The `withAuth` + `requireProjectAccess` helper exists; batch migration of `/api/projects/**` and `/api/orders/**` mutation routes is the P1 closure.
2. **`/today` and calendar only light up for a woodworker if `User.employeeId` is linked.** Invite / onboarding must enforce that link or explicitly route them to ask admin; otherwise the woodworker-facing promise is invisible.
3. **No task-level time reporting yet.** Punches aren't tagged to the `ProjectProcessStep` the employee is actually working on, which blocks §8 (standard time baselines) from ever leaving 1/5.

**Top 3 actions before next review (commit these, cut everything else):**
1. **Migrate `/api/projects/**` + `/api/orders/**` mutation routes to `withAuth` + `requireProjectAccess`** — closes §11 to 4.5 and unblocks a clean audit of role enforcement.
2. **Wire `/punch/[station]` to the currently-in-progress `ProjectProcessStep` for the scanning employee** — single change that moves §8 from 1 to 3 and §6 from 3.5 to 4.
3. **Build the executive 30-second summary for `/` home** — active, blocked, ordering-needed, overdue — moves §13 from 3 to 4 and gives owners a reason to check the app daily.

---

## The atomic unit — canonical definition

The app has exactly one atomic unit: **a Project**.

A Project is a single customer job that will be built, delivered, and paid
for. It is the shared container that sales, planners, woodworkers, and admins
all touch — every cost, every punch, every service call, every email, every
deviation attaches to a Project or to one of its sub-entities.

**Lifecycle stages** (`Project.stage`, canonical left-to-right):

```
  quote  ──▶  invoiced  ──▶  confirmed  ──▶  (production)  ──▶  done
   │            │              │                │                 │
   │            │              │                │                 └── service calls hang off here
   │            │              │                └── ProjectProcessStep runs (assignment gap — not yet built)
   │            │              └── deposit received, planner takes over
   │            └── invoice sent, waiting on deposit
   └── salesperson working with client, no commitment yet
```

**Sub-entities that hang off a Project** (all defined in `prisma/schema.prisma`):

| Entity | Purpose | Who touches it |
|---|---|---|
| `ProjectItem` | One deliverable (vanity / side unit / kitchen / panel) | sales intake, planner review |
| `VanityInputs` / `KitchenInputs` / `SideUnitInputs` | Structured dimensions + options | sales wizard |
| `KitchenPricingProject` | Normalized kitchen quote builder | sales → planner approval |
| `PanelPart` | One line in the cutlist (W × L × qty × material) | cutlist import, planner |
| `MaterialRequirement` | Aggregated need-per-material derived from cutlist | observability engine |
| `CostLine` | Estimate + actual cost rows | planner, vendor invoice mapping |
| `Order` + `OrderLine` | Purchase orders raised against the project | planner, purchasing |
| `Deviation` | Risks surfaced by the observability engine | anyone (dashboard) |
| `ProjectProcessStep` | Per-project instance of a template step (assignment TBD) | planner → woodworker |
| `TimePunch` | Shop-floor time at a station, tied to project | woodworker (QR kiosk) |
| `ServiceCall` | After-delivery visit (warranty / repair / revisit) | sales, planner, shop |
| `AuditLog` | Change history for the project | system (automatic) |
| `MaterialSnapshot` | Saved ingredient state (per vanity / kitchen) | planner |

**The flow one Project experiences, in order, when everything works:**

1. **Sales intake** — salesperson clicks "New Project", fills the wizard (or
   drops a PDF quote and confirms the parsed values). Project is created with
   `stage = "quote"`, assigned to that salesperson.
2. **Quote → Invoice** — salesperson produces the estimate (kitchen pricing
   builder for kitchens, or the section configurator for vanities). Moves to
   `stage = "invoiced"` when the invoice is sent.
3. **Deposit → Confirmed** — `depositReceivedAt` is stamped; stage flips to
   `confirmed`; the next-action on the project card changes from "waiting on
   deposit" to "hand off to shop". Ownership effectively transfers from
   salesperson → planner.
4. **Planner readiness** — planner reviews intake completeness against the
   readiness check (`src/lib/readiness.ts`). If fields are missing, the card
   shows what's missing and who owes it. (Enforcement is advisory today, will
   become a hard block — see Section 3.)
5. **Cutlist + materials** — panel parts are ingested (`PanelPart` rows), the
   observability engine recalculates `MaterialRequirement`s, compares them to
   live inventory, raises `Deviation`s for any shortage, and the AI suggests a
   purchase draft.
6. **Purchasing** — planner/purchasing places orders. When lines are received
   (`/api/orders/[id]/receive`), inventory increases, deviations resolve, the
   project is now production-ready.
7. **Production** — *today, this is the gap.* The intended flow is: planner
   instantiates the Process Template → `ProjectProcessStep` rows get created
   → planner assigns each step to an employee and a date → woodworker opens
   "My Day" → sees today's assigned steps → punches into the station → step
   flips to `in_progress` → punch-out moves it to `done`.
8. **Delivery + invoice reconciliation** — project flips to `isDone = true`,
   vendor invoices are mapped to the project's cost lines, and actual margin
   settles against estimated.
9. **Service calls** — any post-delivery issue creates a `ServiceCall` that
   hangs off the project and appears on Calendar + Service Calls page.

**Everything that breaks in the current tools breaks here:**

- A Monday.com board entry has no cost side, no inventory side, no punches.
- An email thread has no stage, no blockers, no readiness check.
- A Google Drive folder has no sense of "this quote became this invoice".
- A text message is not a thing the system can run an observability engine on.

The whole point of this app is that a **Project is the single row that
everything attaches to** — and any change to any attached entity
(`recalculateProjectState`) re-derives the current picture.

---

## Review cadence and governance

- **Cadence:** Weekly for first 4 weeks after Tier 1 work begins, then bi-weekly
- **Participants:** Admin + Planner + one shop-floor representative
- **Rule:** Any section scoring < 3 must have an owner + target date before review ends
- **Rule:** Any section scoring 4+ needs at least one evidence artifact (screen, report, metric, or SOP)
- **Rule:** Do not begin lean refactor (PHASE_2_LEAN_REFACTOR_PLAN) until sections 1, 3, 6, 11 all reach 4+

# Atelier Pelissier — Master Roadmap

**Single source of truth.** Replaces IMPROVEMENTS.md and PHASE2.md (both archived — their work is either done or superseded by this document).  
Last updated: 2026-04-14

> **What changed since 2026-04-09:**
> - Configuration-to-material-truth subsystem landed (ingredient engine, material snapshots, construction standards, section configurator).
> - Role-aware next-action spine (`getNextAction`) now drives project cards and the project detail header.
> - PDF invoice drop-zone on New Project pre-fills the wizard via `parseInvoiceText` heuristics (pdf-parse → LlamaParse fallback).
> - Sales lifecycle stage (`Project.stage` = `quote` / `invoiced` / `confirmed`) added with wizard picker, list section, and role-branch routing in `getNextAction`.
> - VanityTab refactored to section-canonical layout — the old flat doors/drawers inputs are gone and vanity width now rescales sections instead of conflicting with them.
> - Impact on scorecard: sections 3, 4, 11, 13 moved (details in `docs/OPERATIONS_MATURITY_ROADMAP.md`).

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

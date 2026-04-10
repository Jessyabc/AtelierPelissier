# Phase 1: Operational Maturity Plan
> **This is a supporting detail document.** The master backlog and priorities live in [`/ROADMAP.md`](../ROADMAP.md). The maturity scorecard lives in [`docs/OPERATIONS_MATURITY_ROADMAP.md`](./OPERATIONS_MATURITY_ROADMAP.md). Use this file for detailed workstream specs (WS-1 through WS-8) when implementing.

## 1. Executive judgment

The app has meaningful structural foundations: projects with lifecycle flags, a deviation engine, inventory/purchasing pipelines, AI action queuing with approval, QR punch stations, process templates, cutlist parsing, and newly added Supabase auth with role-based session logic.

What the app does not yet have is **operational reliability at the seams**. The sales-to-production boundary is a soft click. Blockers are computed but not enforced. Roles exist in the database but the UI is still admin-shaped for everyone. Dashboards surface data but don't drive decisions. The AI can propose actions but there is no ingestion pipeline feeding it automatically. Export is a JSON dump with no restore, no incremental backup, and no monitoring.

The honest read: the app is a **3/5 structurally** and a **2/5 operationally**. Phase 1 closes that gap by hardening enforcement, gating, visibility, role filtering, and resilience — without adding new features for their own sake.

## 2. What Phase 1 is trying to achieve

- **Trust**: the team can rely on the system instead of asking you.
- **Enforcement**: the system prevents avoidable errors rather than hoping people follow convention.
- **Clarity**: each role sees only what they need, and blocked/next-action states are obvious.
- **Resilience**: data is backed up, deployments are monitored, and exceptions have explicit paths.
- **Safe automation**: AI actions are gated by role, explained before execution, and auditable after.

Phase 1 is not about building new intelligence. It is about making existing intelligence trustworthy.

## 3. Ranked execution order

| Priority | Workstream | Why first |
|----------|-----------|-----------|
| 1 | Production-readiness gate | Highest leverage: prevents garbage-in from reaching production |
| 2 | Blocked vs active distinction | Makes dashboards and cockpit actually useful |
| 3 | Role-filtered UI + menu | Adoption killer if woodworkers see admin clutter |
| 4 | Backup + monitoring | Cannot iterate safely without recovery and observability |
| 5 | Ingestion pipeline design | Enables the next wave of AI usefulness without silent errors |
| 6 | Exception handling paths | Prevents silent failures that erode trust |
| 7 | Dashboard executive mode | Makes the owner's 30-second check actually work |
| 8 | Standard time baseline collection | Unlocks future estimation accuracy |

## 4. Milestones

| Milestone | Target | Key deliverable |
|-----------|--------|-----------------|
| M1: Gate & block | Week 2 | Production-readiness gate enforced; blocked reasons visible on project detail and cockpit |
| M2: Role clarity | Week 4 | Role-filtered navigation, role-specific landing pages, woodworker simplified view |
| M3: Backup & monitor | Week 5 | Automated DB backup, Vercel deployment health check, error rate alerting |
| M4: Ingestion design | Week 7 | Pipeline state machine designed, confidence scoring spec, dedupe strategy documented |
| M5: Exception paths | Week 8 | Top 5 exception types have explicit queues with owner and SLA |
| M6: Dashboard v2 | Week 9 | Executive 30-second mode, blocked/ordering/next-action widgets |
| M7: Baseline timing | Week 10 | First 10 tasks defined, collection running, monthly baseline report |

## 5. Detailed workstreams

### WS-1: Production-readiness gate

**Current state**: `isDraft: false` is a button click with no validation. No fields are required before activation.

**Target**: a `readinessChecklist` concept — either schema fields or a computed check — that blocks `isDraft: false` when critical data is missing.

**Work**:
- Schema: add `readinessStatus` (computed or stored) to `Project`. Define required fields: `jobNumber`, `clientId` or embedded client name, at least one `ProjectItem`, `targetDate`.
- API: `PATCH /api/projects/[id]` rejects `isDraft: false` if readiness check fails; returns missing fields list.
- UI: project detail shows readiness checklist card. Missing items are red. Save button is disabled or warns.
- Audit: log `readiness_blocked` when attempted and failed.

**Dependencies**: none.

**Score impact**: Core foundation 2.5 → 3.5, Intake 3 → 3.5, Handoff 2.5 → 3.5.

### WS-2: Blocked vs active distinction

**Current state**: deviations exist and are computed, but there is no first-class "blocked" state on a project. The cockpit shows shortages and deviations, but you have to interpret them.

**Target**: explicit blocked status with reason codes, visible everywhere projects are listed.

**Work**:
- Schema: add `blockedReason` (nullable string enum: `missing_material`, `waiting_cutlist`, `waiting_approval`, `supplier_delay`, `missing_info`, `change_order`, null = not blocked) to `Project`.
- API: `PATCH /api/projects/[id]` accepts `blockedReason`. Auto-set by deviation engine when `inventory_shortage` severity is `high`/`critical`. Auto-clear when resolved.
- UI: project list shows blocked badge with reason. Cockpit groups projects by blocked vs active. Dashboard blocked widget.
- AI: `getProjectStatus` includes blocked state. New tool `getBlockedProjects` returns blocked list with reasons.

**Dependencies**: WS-1 (readiness gate informs `missing_info` block reason).

**Score impact**: Workflow 2.5 → 3.5, Dashboard 3 → 3.5.

### WS-3: Role-filtered UI and navigation

**Current state**: `AppHeader` renders the same menu for all roles. `AppConfig.menuConfig` controls visibility but is not role-aware. API auth checks exist on sensitive routes but UI still shows everything.

**Target**: menu items filtered by `User.role` client-side. Role-specific landing pages. Woodworker sees: punch, assigned projects, calendar. Planner sees: cockpit, projects, calendar, purchasing, service calls. Owner sees: dashboard, cockpit, reports.

**Work**:
- Add `GET /api/auth/me` role to client state (already exists).
- `AppHeader`: fetch role once, filter `menuConfig` by allowed role set.
- Define role → allowed routes map in `src/lib/auth/roles.ts`.
- Add role-specific redirect after login: woodworker → `/punch/[default-station]` or project list, planner → `/home`, owner → `/dashboard`, admin → `/`.
- Middleware: add page-level role gating for `/admin/*` (admin only), `/processes/*` (admin + planner).

**Dependencies**: none (auth/roles infrastructure exists).

**Score impact**: Roles 2.5 → 4, Adoption 2 → 3.

### WS-4: Backup and monitoring

**Current state**: `GET /api/export` dumps JSON (projects + distributors only). No automated backup. No deployment health monitoring. No error rate alerting.

**Target**: automated daily DB backup (Neon supports this natively), deployment health endpoint, basic error rate alerting.

**Work**:
- Neon: enable point-in-time recovery (Neon branching / built-in backups). Document restore procedure.
- Add `GET /api/health` endpoint: returns DB connectivity, last error count (24h), deployment commit SHA (`VERCEL_GIT_COMMIT_SHA`), uptime.
- Expand `/api/export` to include all models (inventory, orders, employees, config, AI conversations).
- Add Vercel deployment protection rules or a cron-based uptime check (external or Vercel Cron).
- Document backup/restore SOP in `docs/BACKUP_AND_RECOVERY.md`.

**Dependencies**: none.

**Score impact**: Data integrity 1 → 3, Deployment 1.5 → 3.

### WS-5: Ingestion pipeline design

**Current state**: cutlist PDF parsing exists. No email ingestion. No invoice auto-matching. No confidence scoring. No dedupe.

**Target**: a designed (not fully built) ingestion pipeline with state machine, confidence thresholds, and human confirmation flow. Implementation of the first stage (manual upload → parse → match → confirm).

**Work**:
- Design: document pipeline states (`received` → `parsed` → `matched` → `needs_review` → `applied`), confidence scoring model, dedupe keys (file hash, invoice number + supplier + date).
- Schema: add `IngestedDocument` model (source, state, confidence, matchedProjectId, reviewedBy, appliedAt, hash).
- API: `POST /api/ingest` accepts PDF/email payload, runs parser, returns match candidates with confidence.
- UI: admin/planner review queue for `needs_review` documents.
- AI: teach assistant to use ingested documents as context when answering project questions.

**Dependencies**: WS-1 (project matching requires stable project identity).

**Score impact**: Ingestion 1.5 → 3, Matching 2 → 3.

### WS-6: Exception handling paths

**Current state**: deviations are raised but there is no explicit exception queue, no owner assignment, no SLA, no recovery playbook.

**Target**: top 5 exception types have explicit queues with owner and expected resolution time.

**Work**:
- Define top 5: `missing_info`, `supplier_delay`, `cost_overrun_critical`, `receiving_mismatch`, `change_after_production`.
- Schema: add `exceptionType`, `assignedTo`, `dueBy` to `Deviation` (or a new `Exception` model linked to deviation).
- API: exception listing with filters. Assignment endpoint.
- UI: exception queue in cockpit sidebar. Color-coded by SLA status.
- SOP: one-page recovery playbook per exception type.

**Dependencies**: WS-2 (blocked reasons feed exception types).

**Score impact**: Exception handling 2 → 3.5.

### WS-7: Dashboard executive mode

**Current state**: dashboard exists with metrics and deviations. Not optimized for 30-second comprehension.

**Target**: top-of-dashboard summary cards: active count, blocked count, needs-ordering count, overdue count. One-click drill into each.

**Work**:
- API: add `/api/dashboard/summary` returning counts (active, blocked, ordering-needed, overdue, on-track percentage).
- UI: summary card row at top of `/dashboard`. Click → filtered view.
- Add "last updated" timestamp so the owner knows data freshness.

**Dependencies**: WS-2 (blocked count requires blocked status).

**Score impact**: Dashboard 3 → 4.

### WS-8: Standard time baseline collection

**Current state**: QR punch data is collected but no baseline analysis exists. No task taxonomy. No outlier detection.

**Target**: first 10 repeatable tasks defined, collection protocol documented, monthly baseline computation.

**Work**:
- Define task taxonomy (10 tasks: cut panels, edge band, assemble cabinet, install hardware, sand, finish, install countertop, install sink, QC check, pack/ship).
- Map tasks to stations and project types.
- Add reporting query: average duration per task per project type, with p50/p90/outlier flagging.
- Add `/api/reports/time-baselines` endpoint.
- Document collection protocol as SOP.

**Dependencies**: WS-3 (role clarity ensures punch data is clean).

**Score impact**: Time baselines 1 → 2.5.

## 6. Dependency map

```
WS-1 (gate) ──────────────────┐
     │                         │
     ▼                         ▼
WS-2 (blocked) ──────► WS-6 (exceptions) ──► WS-7 (dashboard v2)
     │
     ▼
WS-5 (ingestion design)

WS-3 (roles) ─────────► WS-8 (baselines)

WS-4 (backup) ────────── independent
```

## 7. Fastest maturity gains

| Effort | Gain | Workstream |
|--------|------|-----------|
| Small | High | WS-3: Role-filtered menu (hours of work, immediate adoption impact) |
| Small | High | WS-4: Neon backup enable + health endpoint (afternoon of work, massive risk reduction) |
| Medium | High | WS-1: Readiness gate (2-3 days, prevents the #1 operational failure mode) |
| Medium | High | WS-2: Blocked status (2-3 days, transforms dashboard from data to decisions) |

## 8. Score impact forecast

| Section | Current | Post-Phase 1 | Delta |
|---------|---------|-------------|-------|
| Core foundation | 2.5 | 3.5 | +1.0 |
| Intake | 3.0 | 3.5 | +0.5 |
| Handoff | 2.5 | 3.5 | +1.0 |
| Ingestion | 1.5 | 3.0 | +1.5 |
| Matching | 2.0 | 3.0 | +1.0 |
| Workflow | 2.5 | 3.5 | +1.0 |
| QR timing | 3.0 | 3.0 | 0 |
| Time baselines | 1.0 | 2.5 | +1.5 |
| Inventory | 3.5 | 3.5 | 0 |
| Cutlist | 3.0 | 3.0 | 0 |
| Roles | 2.5 | 4.0 | +1.5 |
| AI actions | 3.0 | 3.5 | +0.5 |
| Dashboard | 3.0 | 4.0 | +1.0 |
| Exceptions | 2.0 | 3.5 | +1.5 |
| Adoption | 2.0 | 3.0 | +1.0 |
| Commercialization | 1.0 | 1.0 | 0 |
| Data integrity | 1.0 | 3.0 | +2.0 |
| Deployment | 1.5 | 3.0 | +1.5 |
| **Overall** | **2.25** | **3.19** | **+0.94** |

## 9. Biggest risks and false-maturity traps

1. **Role filtering without adoption testing**: filtering the menu is easy. Getting woodworkers to actually use the simplified view requires direct observation and feedback in the first 2 weeks.
2. **Readiness gate that is too strict too fast**: if the gate blocks projects that the team normally starts with partial info, adoption will crater. Start with warnings, then enforce after 2 weeks.
3. **Ingestion pipeline scope creep**: designing the pipeline is Phase 1. Building the full email-to-action automation is not. Do not collapse the two.
4. **Dashboard metrics without context**: showing "12 blocked projects" is only useful if clicking it shows why and what to do next.
5. **Backup configured but never tested**: schedule a quarterly restore drill and document it.

## 10. What to postpone on purpose

- **Email auto-ingestion**: design only. Full SMTP/IMAP automation is Phase 1.5 or later.
- **Profitability forecasting**: depends on clean time baselines that don't exist yet.
- **Scheduling optimization**: depends on reliable blocked/active states and baseline data.
- **Voice memo logging**: nice-to-have, not operational.
- **Commercialization**: explicitly out of scope until internal maturity is proven.
- **Aggressive page/endpoint consolidation**: that is Phase 2 work that depends on Phase 1 evidence.

## 11. Final recommendation

Start with WS-3 (role-filtered menu) and WS-4 (backup + health) in parallel — they are independent, low-risk, and immediately visible. Then WS-1 (readiness gate) and WS-2 (blocked status) in the next sprint. These four workstreams alone will move the overall score from 2.25 to roughly 2.9 and will transform how the team experiences the app daily.

Do not skip WS-4. A system without backup and health monitoring is a system that will eventually hurt you in a way you cannot recover from.

Do not rush WS-5 (ingestion). Design it properly first. The biggest operational disasters come from AI confidently doing the wrong thing with unverified data.

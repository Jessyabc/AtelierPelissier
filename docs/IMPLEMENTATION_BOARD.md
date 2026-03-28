# Implementation Board: Ticket-Ready Execution Plan

---

## 1. Executive implementation summary

This board converts the Phase 1 (operational maturity) and Phase 2 (lean refactor) plans into sprint-assignable tickets. There are **42 Phase 1 tickets** across 8 epics and **18 Phase 2 tickets** across 5 epics.

Phase 1 targets 10 weeks of execution across 5 sprints (2 weeks each). Phase 2 begins only after Phase 1 M1-M5 are validated + 4 weeks of usage data, meaning Phase 2 sprint planning starts no earlier than week 14.

Key constraint: Phase 2 tickets are tagged with explicit evidence gates. No Phase 2 implementation ticket may begin without its gate being satisfied.

---

## 2. Phase 1 Epics

| Epic ID | Epic | Workstream | Sprint target |
|---------|------|-----------|---------------|
| P1-E1 | Production-Readiness Gate | WS-1 | Sprint 2 |
| P1-E2 | Blocked vs Active Distinction | WS-2 | Sprint 2-3 |
| P1-E3 | Role-Filtered UI & Navigation | WS-3 | Sprint 1 |
| P1-E4 | Backup, Monitoring & Health | WS-4 | Sprint 1 |
| P1-E5 | Ingestion Pipeline Design | WS-5 | Sprint 3-4 |
| P1-E6 | Exception Handling Paths | WS-6 | Sprint 4 |
| P1-E7 | Dashboard Executive Mode | WS-7 | Sprint 4-5 |
| P1-E8 | Standard Time Baselines | WS-8 | Sprint 5 |

---

## 3. Phase 1 Tickets

### Epic P1-E1: Production-Readiness Gate

---

**P1-001: Define readiness field requirements**
- Phase: 1
- Epic: P1-E1
- Type: Implementation
- Description: Define the set of required fields before a project can leave draft (`isDraft: false`). Minimum: `jobNumber`, `clientId` or embedded client name, at least one `ProjectItem`, `targetDate`.
- Why it matters: Prevents garbage-in reaching production; single highest-leverage improvement.
- Dependencies: None
- Owner type: Product/Ops + Backend
- Size: S
- Acceptance criteria:
  - Required fields list documented in code and SOP
  - `src/lib/readiness.ts` exports `computeReadinessCheck(project)` returning `{ ready: boolean, missing: string[] }`
  - Unit test covering each missing-field case
- Risk if skipped: Every downstream workflow inherits bad data.
- Label: **Safe win**

---

**P1-002: Enforce readiness gate in project PATCH API**
- Phase: 1
- Epic: P1-E1
- Type: Implementation
- Description: `PATCH /api/projects/[id]` rejects `isDraft: false` if `computeReadinessCheck` fails. Returns `400` with missing fields list. First 2 weeks: return warning header but allow save. After 2 weeks: hard block.
- Why it matters: Without enforcement, the gate is advisory and will be ignored.
- Dependencies: P1-001
- Owner type: Backend
- Size: M
- Acceptance criteria:
  - API returns `{ error: "readiness_check_failed", missing: [...] }` on hard mode
  - API returns `{ warning: "readiness_incomplete", missing: [...] }` in header during soft mode
  - `readiness_blocked` audit log entry created on rejection
  - Existing projects already active (`isDraft: false`) are not affected
- Risk if skipped: Gate exists in theory but not in practice.
- Caution: AI `updateProjectStatus` tool also sets `isDraft: false` — must also go through the gate.

---

**P1-003: Readiness checklist UI card on project detail**
- Phase: 1
- Epic: P1-E1
- Type: Implementation
- Description: Add a readiness card to the project detail page showing each required field with green check or red missing indicator. Save button shows warning tooltip when incomplete.
- Why it matters: Users need to see what is missing before they attempt to save.
- Dependencies: P1-001
- Owner type: Frontend
- Size: M
- Acceptance criteria:
  - Card visible on all draft projects
  - Missing fields highlighted in red
  - Save button disabled or warns (depending on soft/hard mode)
  - Card disappears when project is already saved (not draft)
- Risk if skipped: Users hit the API block with no context on what to fix.

---

**P1-004: Log readiness gate rejections for adoption monitoring**
- Phase: 1
- Epic: P1-E1
- Type: Implementation
- Description: Track readiness gate rejection rate and which fields are most commonly missing. Feed into a simple admin report or query.
- Why it matters: Tells you whether to tighten or loosen the gate based on real data.
- Dependencies: P1-002
- Owner type: Backend
- Size: S
- Acceptance criteria:
  - Audit log entries queryable by `action: "readiness_blocked"`
  - Admin can see top missing fields in the last 30 days
- Risk if skipped: Gate tuning is guesswork.

---

### Epic P1-E2: Blocked vs Active Distinction

---

**P1-005: Add `blockedReason` field to Project schema**
- Phase: 1
- Epic: P1-E2
- Type: Implementation
- Description: Add nullable `blockedReason` string to `Project` model. Values: `missing_material`, `waiting_cutlist`, `waiting_approval`, `supplier_delay`, `missing_info`, `change_order`, or `null` (not blocked). Run `prisma db push`.
- Why it matters: Without a first-class blocked state, "blocked" is something you have to infer from deviations.
- Dependencies: None
- Owner type: Backend
- Size: XS
- Acceptance criteria:
  - Schema migrated; field exists in DB
  - `PATCH /api/projects/[id]` accepts `blockedReason`
  - Existing projects default to `null`
- Risk if skipped: All downstream blocked-visibility tickets have no data to work with.

---

**P1-006: Auto-set blocked status from deviation engine**
- Phase: 1
- Epic: P1-E2
- Type: Implementation
- Description: When `recalculateInventoryRisk` creates/updates a deviation with severity `high` or `critical` and type `inventory_shortage`, auto-set `blockedReason: "missing_material"` on the project. Auto-clear when deviation is resolved.
- Why it matters: Manual blocking is a step people will forget.
- Dependencies: P1-005
- Owner type: Backend
- Size: M
- Acceptance criteria:
  - Project automatically blocked when critical shortage detected
  - Project automatically unblocked when shortage resolved
  - Blocked reason logged in audit
- Risk if skipped: Blocked status exists but is never populated automatically.
- Caution: `recalculateProjectState` cascades through 5 sub-calculations. Test that auto-blocking does not create infinite recalculation loops.

---

**P1-007: Blocked badge on project lists and cockpit**
- Phase: 1
- Epic: P1-E2
- Type: Implementation
- Description: Show a color-coded blocked badge with reason text on: (a) main project list `/`, (b) cockpit `/home`, (c) dashboard project rows. Group cockpit by blocked vs active.
- Why it matters: Blocked projects must be visually distinct without clicking into them.
- Dependencies: P1-005
- Owner type: Frontend
- Size: M
- Acceptance criteria:
  - Blocked badge visible on all three project listing surfaces
  - Badge shows reason in human-readable form (e.g. "Missing material")
  - Cockpit groups: "Blocked" section above "Active" section
- Risk if skipped: Blocked status exists in DB but nobody sees it.

---

**P1-008: AI tool `getBlockedProjects`**
- Phase: 1
- Epic: P1-E2
- Type: Implementation
- Description: Add AI function tool that returns all projects where `blockedReason IS NOT NULL`, grouped by reason, with project name/job number/reason.
- Why it matters: Lets users ask "what's blocked?" and get an actionable answer.
- Dependencies: P1-005
- Owner type: AI/Backend
- Size: S
- Acceptance criteria:
  - Tool registered in `AI_TOOLS` array
  - `executeFunctionCall` handles `getBlockedProjects`
  - Returns structured list sorted by severity
- Risk if skipped: AI cannot answer the most common operations question.

---

**P1-009: Manual block/unblock from project detail**
- Phase: 1
- Epic: P1-E2
- Type: Implementation
- Description: Add a dropdown or quick-action on project detail to manually set or clear `blockedReason`. Useful for reasons the deviation engine cannot detect (e.g. `waiting_approval`, `change_order`).
- Why it matters: Not all blocks are computed; some are human knowledge.
- Dependencies: P1-005
- Owner type: Frontend
- Size: S
- Acceptance criteria:
  - Dropdown with all reason options + "Clear block"
  - Calls `PATCH /api/projects/[id]` with `blockedReason`
  - Audit log entry on change
- Risk if skipped: Only auto-detected blocks are visible; manual blocks remain invisible.

---

### Epic P1-E3: Role-Filtered UI & Navigation

---

**P1-010: Define role-to-route permission map**
- Phase: 1
- Epic: P1-E3
- Type: Implementation
- Description: In `src/lib/auth/roles.ts`, define `ROLE_ALLOWED_ROUTES: Record<AppRole, string[]>` mapping each role to allowed page paths. Also define `ROLE_MENU_FILTER` for which menu items each role sees.
- Why it matters: Single source of truth for all role-filtering logic.
- Dependencies: None
- Owner type: Full-stack
- Size: S
- Acceptance criteria:
  - Map covers all 4 roles (admin, planner, salesperson, woodworker)
  - Map covers all current page routes
  - Exported and used by both middleware and AppHeader
- Risk if skipped: Role filtering is ad-hoc and inconsistent.
- Label: **Safe win**

---

**P1-011: Filter AppHeader menu by user role**
- Phase: 1
- Epic: P1-E3
- Type: Implementation
- Description: `AppHeader` fetches `GET /api/auth/me` once (or reads from context), then filters `menuConfig` against `ROLE_MENU_FILTER[role]`. Non-matching items are hidden, not grayed.
- Why it matters: Single most visible change for adoption. Woodworkers stop seeing admin noise.
- Dependencies: P1-010
- Owner type: Frontend
- Size: S
- Acceptance criteria:
  - Woodworker sees: assigned projects, punch, calendar only
  - Planner sees: cockpit, projects, calendar, purchasing, service calls, processes
  - Owner sees: dashboard, cockpit, reports
  - Admin sees: everything
- Risk if skipped: Every role sees an admin-shaped app. Adoption suffers.
- Label: **Safe win**

---

**P1-012: Role-specific redirect after login**
- Phase: 1
- Epic: P1-E3
- Type: Implementation
- Description: After login (no `?next=` param), redirect based on role: woodworker → `/` (project list), planner → `/home`, owner → `/dashboard`, admin → `/`.
- Why it matters: Each role lands on the surface most relevant to them.
- Dependencies: P1-010
- Owner type: Frontend
- Size: XS
- Acceptance criteria:
  - Redirect logic in login page or middleware
  - Works after fresh login and after session resume
- Risk if skipped: Everyone lands on the same page regardless of role.

---

**P1-013: Middleware page-level role gating**
- Phase: 1
- Epic: P1-E3
- Type: Implementation
- Description: In `src/middleware.ts`, after verifying Supabase session, check if the requested page path is allowed for the user's role (from `ROLE_ALLOWED_ROUTES`). If not, redirect to their role-default page.
- Why it matters: URL direct access should not bypass role filtering.
- Dependencies: P1-010
- Owner type: Backend
- Size: M
- Acceptance criteria:
  - Woodworker navigating to `/admin` is redirected to `/`
  - Planner navigating to `/admin` is redirected to `/home`
  - Admin can access everything
  - Redirect is a 307 with a query param `?denied=role`
- Risk if skipped: Users can bypass role filtering by typing URLs.
- Caution: Middleware currently calls `supabase.auth.getUser()` but does not load `User.role` from Neon. This ticket requires either a lightweight DB call or caching the role in a cookie/header.

---

**P1-014: Add usage tracking middleware for Phase 2 evidence**
- Phase: 1
- Epic: P1-E3
- Type: Implementation
- Description: Lightweight page visit logger: on each page navigation, log `{ userId, role, pathname, timestamp }` to a `PageVisit` table or append-only log. Used for Phase 2 evidence collection.
- Why it matters: Phase 2 decisions depend on per-role page visit frequency. Must start collecting from day 1 of role filtering.
- Dependencies: P1-010
- Owner type: Backend
- Size: M
- Acceptance criteria:
  - Schema: `PageVisit` model with `userId`, `role`, `pathname`, `createdAt`
  - Middleware or client-side hook logs visit on each navigation
  - Admin can query visits per role per page
- Risk if skipped: Phase 2 has no evidence base and every cut is a guess.

---

### Epic P1-E4: Backup, Monitoring & Health

---

**P1-015: Enable Neon point-in-time recovery**
- Phase: 1
- Epic: P1-E4
- Type: Infra
- Description: In Neon dashboard, confirm PITR is enabled on the production database. Document the branching/restore procedure in `docs/BACKUP_AND_RECOVERY.md`.
- Why it matters: Without backup, one bad migration or accidental deletion is permanent.
- Dependencies: None
- Owner type: Infra
- Size: XS
- Acceptance criteria:
  - PITR confirmed enabled in Neon dashboard
  - `docs/BACKUP_AND_RECOVERY.md` documents restore steps
- Risk if skipped: Unrecoverable data loss on any incident.
- Label: **Safe win**

---

**P1-016: Add `GET /api/health` endpoint**
- Phase: 1
- Epic: P1-E4
- Type: Implementation
- Description: Public health endpoint returning: DB connectivity (Prisma `$queryRaw SELECT 1`), error count (24h from `AppErrorLog`), deployment commit SHA (`VERCEL_GIT_COMMIT_SHA`), build timestamp.
- Why it matters: Confirms what version is running and whether DB is reachable.
- Dependencies: None
- Owner type: Backend
- Size: XS
- Acceptance criteria:
  - Returns `200` with JSON payload when healthy
  - Returns `503` if DB is unreachable
  - Commit SHA matches latest deployment
- Risk if skipped: No way to remotely verify deployment state.
- Label: **Safe win**

---

**P1-017: Expand `/api/export` to all models**
- Phase: 1
- Epic: P1-E4
- Type: Implementation
- Description: Current export covers projects + distributors. Expand to include: inventory items, orders, employees, suppliers, config, AI conversations, service calls, calendar events, process templates.
- Why it matters: JSON export is the last-resort backup if Neon PITR fails.
- Dependencies: None
- Owner type: Backend
- Size: M
- Acceptance criteria:
  - Export JSON includes all listed model categories
  - File size is manageable (<50MB for typical data)
  - Admin-only access (already enforced by middleware)
- Risk if skipped: Partial backup that misses critical operational data.

---

**P1-018: Document backup/restore SOP**
- Phase: 1
- Epic: P1-E4
- Type: Product/Ops
- Description: Write `docs/BACKUP_AND_RECOVERY.md` covering: Neon PITR restore, JSON export download + re-import procedure, quarterly restore drill schedule.
- Why it matters: Backup that has never been tested is not a backup.
- Dependencies: P1-015, P1-017
- Owner type: Product/Ops
- Size: S
- Acceptance criteria:
  - SOP covers both Neon restore and JSON import
  - Quarterly restore drill scheduled with date + owner
  - Accessible to admin role
- Risk if skipped: Backup exists but nobody knows how to use it.

---

**P1-019: External uptime monitoring**
- Phase: 1
- Epic: P1-E4
- Type: Infra
- Description: Set up a free uptime monitor (e.g. Vercel Cron hitting `/api/health`, or external service like Better Uptime / UptimeRobot) that alerts on downtime or `503`.
- Why it matters: You need to know when the site is down before your team tells you.
- Dependencies: P1-016
- Owner type: Infra
- Size: XS
- Acceptance criteria:
  - Monitor checks `/api/health` every 5 minutes
  - Alert sent (email or Slack) on 2 consecutive failures
- Risk if skipped: Outages go unnoticed for hours.

---

### Epic P1-E5: Ingestion Pipeline Design

---

**P1-020: Document ingestion pipeline state machine**
- Phase: 1
- Epic: P1-E5
- Type: Investigation/Design
- Description: Design and document the ingestion pipeline states: `received` → `parsed` → `matched` → `needs_review` → `applied`. Define transition rules, confidence scoring model, and dedupe keys (file hash, invoice number + supplier + date).
- Why it matters: Building ingestion without a clear state machine creates the silent-disaster pipeline.
- Dependencies: P1-001 (stable project identity for matching)
- Owner type: Product/Ops + AI
- Size: M
- Acceptance criteria:
  - State machine diagram in `docs/INGESTION_PIPELINE_DESIGN.md`
  - Confidence scoring thresholds defined (e.g. >0.9 auto-match, 0.6-0.9 needs_review, <0.6 manual)
  - Dedupe strategy documented
- Risk if skipped: Ingestion implementation proceeds without design and creates silent duplicates or mismatches.

---

**P1-021: Add `IngestedDocument` Prisma model**
- Phase: 1
- Epic: P1-E5
- Type: Implementation
- Description: Schema: `IngestedDocument` with `id`, `source` (upload/email/api), `state` (received/parsed/matched/needs_review/applied), `fileHash`, `fileName`, `parsedJson`, `matchedProjectId`, `confidence`, `reviewedByUserId`, `appliedAt`, `createdAt`.
- Why it matters: Without the model, the pipeline has no persistence layer.
- Dependencies: P1-020
- Owner type: Backend
- Size: S
- Acceptance criteria:
  - Model in schema, pushed to DB
  - Indexes on `state`, `fileHash`, `matchedProjectId`
- Risk if skipped: Pipeline design exists on paper only.

---

**P1-022: Manual upload → parse → match → confirm flow**
- Phase: 1
- Epic: P1-E5
- Type: Implementation
- Description: First stage of ingestion: admin/planner uploads a PDF (invoice or cutlist) via UI. System parses, attempts project matching by invoice number / job number / client name, returns match candidates with confidence scores. User confirms or corrects match.
- Why it matters: Proves the pipeline design works before adding automation.
- Dependencies: P1-021
- Owner type: Full-stack
- Size: L
- Acceptance criteria:
  - Upload UI in admin or cockpit
  - Parse uses existing `pdf-parse` + LlamaParse fallback
  - Match candidates shown with confidence scores
  - User confirms → state moves to `applied`; data linked to project
  - Duplicate upload (same hash) detected and warned
- Risk if skipped: Ingestion remains cutlist-only; no invoice or document flow.

---

**P1-023: Review queue UI for `needs_review` documents**
- Phase: 1
- Epic: P1-E5
- Type: Implementation
- Description: Admin/planner-visible queue showing documents in `needs_review` state. Each row: source, parsed summary, top match candidates with confidence, confirm/reject/reassign buttons.
- Why it matters: Low-confidence matches must not auto-apply.
- Dependencies: P1-022
- Owner type: Frontend
- Size: M
- Acceptance criteria:
  - Queue visible from cockpit or admin
  - Filter by state
  - Confirm assigns `matchedProjectId` and moves to `applied`
  - Reject moves to `rejected` state
- Risk if skipped: Low-confidence documents either auto-apply incorrectly or pile up invisibly.

---

### Epic P1-E6: Exception Handling Paths

---

**P1-024: Define top 5 exception types and recovery playbooks**
- Phase: 1
- Epic: P1-E6
- Type: Product/Ops
- Description: Define: `missing_info`, `supplier_delay`, `cost_overrun_critical`, `receiving_mismatch`, `change_after_production`. For each: what triggers it, who owns resolution, expected SLA, recovery steps.
- Why it matters: Without defined playbooks, exceptions are handled ad-hoc.
- Dependencies: P1-005 (blocked reasons)
- Owner type: Product/Ops
- Size: S
- Acceptance criteria:
  - Document in `docs/EXCEPTION_PLAYBOOKS.md`
  - Each of 5 types has: trigger, owner role, SLA, recovery steps
- Risk if skipped: Team improvises on every exception.

---

**P1-025: Add exception fields to Deviation model**
- Phase: 1
- Epic: P1-E6
- Type: Implementation
- Description: Add `exceptionType` (string, nullable), `assignedToUserId` (string, nullable), `dueBy` (DateTime, nullable) to `Deviation`.
- Why it matters: Turns deviations from signals into assignable work items.
- Dependencies: None
- Owner type: Backend
- Size: XS
- Acceptance criteria:
  - Schema pushed; fields exist
  - `PATCH /api/deviations/[id]` accepts new fields
- Risk if skipped: Deviations remain unowned alerts.

---

**P1-026: Exception assignment and listing API**
- Phase: 1
- Epic: P1-E6
- Type: Implementation
- Description: `GET /api/exceptions` returning deviations where `exceptionType IS NOT NULL`, filterable by type, assignee, SLA status (overdue, upcoming, resolved). `PATCH /api/deviations/[id]` for assignment.
- Why it matters: Planner needs a single view of all exceptions with SLA context.
- Dependencies: P1-025
- Owner type: Backend
- Size: S
- Acceptance criteria:
  - Listing endpoint with filters
  - SLA status computed (overdue if past `dueBy` and not resolved)
  - Assignment updates `assignedToUserId`
- Risk if skipped: No API surface for exception management.

---

**P1-027: Exception queue in cockpit sidebar**
- Phase: 1
- Epic: P1-E6
- Type: Implementation
- Description: Add an "Exceptions" panel to the operations cockpit. Color-coded by SLA: green (on track), yellow (due soon), red (overdue). Click to expand or navigate to exception detail.
- Why it matters: Exceptions must be visible at the daily operations level, not buried in project detail.
- Dependencies: P1-026
- Owner type: Frontend
- Size: M
- Acceptance criteria:
  - Panel visible on `/home` (cockpit)
  - Color-coded SLA status
  - Shows count + top 5 by urgency
  - Click navigates to full exception list or project
- Risk if skipped: Exceptions exist in API but nobody checks them.

---

### Epic P1-E7: Dashboard Executive Mode

---

**P1-028: Add `/api/dashboard/summary` endpoint**
- Phase: 1
- Epic: P1-E7
- Type: Implementation
- Description: Returns: `{ activeCount, blockedCount, needsOrderingCount, overdueCount, onTrackPct, lastUpdated }`. Computes from project states, deviations, and order gaps.
- Why it matters: Powers the 30-second executive view.
- Dependencies: P1-005 (blocked status)
- Owner type: Backend
- Size: S
- Acceptance criteria:
  - Returns all 6 fields
  - `blockedCount` matches projects with `blockedReason IS NOT NULL`
  - `needsOrderingCount` matches projects with unresolved `inventory_shortage` deviations
  - `overdueCount` matches projects past `targetDate` that are not done
  - Response time < 500ms
- Risk if skipped: Dashboard has no summary layer.

---

**P1-029: Executive summary cards on dashboard**
- Phase: 1
- Epic: P1-E7
- Type: Implementation
- Description: Top row of `/dashboard`: 5 cards (Active, Blocked, Needs Ordering, Overdue, On Track %). Each card is clickable → filtered project list below.
- Why it matters: Owner must grasp shop status in 30 seconds.
- Dependencies: P1-028
- Owner type: Frontend
- Size: M
- Acceptance criteria:
  - 5 cards at top of dashboard
  - Click on "Blocked" shows only blocked projects
  - Click on "Needs Ordering" shows projects with ordering gaps
  - "Last updated" timestamp visible
- Risk if skipped: Dashboard remains data-dense without a decision layer.

---

**P1-030: "What needs attention today" widget**
- Phase: 1
- Epic: P1-E7
- Type: Implementation
- Description: Below summary cards: combined feed of (a) overdue exceptions, (b) projects newly blocked, (c) orders arriving today, (d) service calls today. Sorted by urgency.
- Why it matters: Turns dashboard from "look at numbers" to "here's what to do."
- Dependencies: P1-028, P1-026
- Owner type: Frontend
- Size: M
- Acceptance criteria:
  - Feed shows top 10 attention items
  - Each item links to relevant project/order/exception
  - Auto-refreshes on dashboard load
- Risk if skipped: Summary cards are nice but don't drive action.

---

### Epic P1-E8: Standard Time Baselines

---

**P1-031: Define task taxonomy (10 repeatable tasks)**
- Phase: 1
- Epic: P1-E8
- Type: Product/Ops
- Description: Define the first 10 standard tasks that apply across most project types. Map each to stations and project types. Document as SOP.
- Why it matters: No baseline is possible without a stable taxonomy.
- Dependencies: P1-011 (role clarity ensures punch data is clean)
- Owner type: Product/Ops
- Size: S
- Acceptance criteria:
  - 10 tasks defined with station mapping
  - Document in `docs/TASK_TAXONOMY.md`
  - Shop lead confirms taxonomy matches reality
- Risk if skipped: Baseline collection has no structure.

---

**P1-032: Add task category to TimePunch**
- Phase: 1
- Epic: P1-E8
- Type: Implementation
- Description: Add optional `taskCategory` (string) to `TimePunch` model. Punch UI shows dropdown of taxonomy tasks. Existing punches default to `null`.
- Why it matters: Punches without task context are noisy data.
- Dependencies: P1-031
- Owner type: Full-stack
- Size: S
- Acceptance criteria:
  - Schema pushed
  - Punch station UI shows task dropdown
  - Default is optional (backward compatible)
- Risk if skipped: Punch data remains unstructured.

---

**P1-033: Time baseline reporting endpoint**
- Phase: 1
- Epic: P1-E8
- Type: Implementation
- Description: `GET /api/reports/time-baselines` returns: per-task average, p50, p90, outlier count, by project type. Filterable by date range.
- Why it matters: Enables estimation accuracy and pricing updates.
- Dependencies: P1-032
- Owner type: Backend
- Size: M
- Acceptance criteria:
  - Returns statistics per task per project type
  - Outlier defined as >2x p90
  - Filterable by date range
- Risk if skipped: Punch data collected but never analyzed.

---

**P1-034: Anomaly detection for punch data**
- Phase: 1
- Epic: P1-E8
- Type: Implementation
- Description: Daily check: flag punches that are open >12 hours, punches with no station, rapid start/stop toggles (<2 min). Surface in admin or cockpit as data quality alerts.
- Why it matters: Bad punch data pollutes baselines.
- Dependencies: P1-032
- Owner type: Backend
- Size: S
- Acceptance criteria:
  - Anomalies surfaced in admin health tab or cockpit
  - Flagged punches can be resolved/dismissed
- Risk if skipped: Baselines include garbage data.

---

## 4. Phase 1 Sprint Plan

### Sprint 1 (Weeks 1-2): Foundation + Quick Wins

**Goal**: Role filtering live, backup enabled, health endpoint deployed. Immediate adoption and safety gains.

| Ticket | Size | Parallel? |
|--------|------|-----------|
| P1-010: Role-to-route permission map | S | Yes |
| P1-011: Filter AppHeader menu by role | S | After P1-010 |
| P1-012: Role-specific redirect after login | XS | After P1-010 |
| P1-015: Enable Neon PITR | XS | Yes |
| P1-016: Add `/api/health` endpoint | XS | Yes |
| P1-019: External uptime monitoring | XS | After P1-016 |

**Why this grouping**: All are low-risk, high-visibility, no dependencies on each other. Delivers the two fastest maturity gains simultaneously.

---

### Sprint 2 (Weeks 3-4): Gates & Blocks

**Goal**: Production-readiness gate enforced (soft mode). Blocked status visible on all project surfaces.

| Ticket | Size | Parallel? |
|--------|------|-----------|
| P1-001: Define readiness requirements | S | Yes |
| P1-002: Enforce readiness gate in API | M | After P1-001 |
| P1-003: Readiness checklist UI card | M | After P1-001 |
| P1-005: Add `blockedReason` schema field | XS | Yes |
| P1-006: Auto-set blocked from deviations | M | After P1-005 |
| P1-007: Blocked badge on project lists | M | After P1-005 |
| P1-009: Manual block/unblock UI | S | After P1-005 |
| P1-013: Middleware page-level role gating | M | Yes |
| P1-014: Usage tracking middleware | M | Yes |

**Why this grouping**: Gate and block are the core operational improvements. Sprint 1 role filtering provides the stable base. Usage tracking starts collecting Phase 2 evidence immediately.

---

### Sprint 3 (Weeks 5-6): Backup Completion + Ingestion Design

**Goal**: Full backup/restore SOP. Ingestion pipeline designed and first model deployed.

| Ticket | Size | Parallel? |
|--------|------|-----------|
| P1-017: Expand export to all models | M | Yes |
| P1-018: Backup/restore SOP | S | After P1-017 |
| P1-004: Readiness gate rejection monitoring | S | Yes |
| P1-008: AI tool `getBlockedProjects` | S | Yes |
| P1-020: Ingestion pipeline design doc | M | After P1-001 |
| P1-021: `IngestedDocument` Prisma model | S | After P1-020 |

**Why this grouping**: Backup completion is overdue. Ingestion design starts after project identity is stable (gate enforced). AI blocked-projects tool capitalizes on Sprint 2 data.

---

### Sprint 4 (Weeks 7-8): Ingestion First Stage + Exceptions

**Goal**: Manual document ingestion working. Exception queues live in cockpit.

| Ticket | Size | Parallel? |
|--------|------|-----------|
| P1-022: Upload → parse → match → confirm | L | Yes |
| P1-023: Review queue UI | M | After P1-022 |
| P1-024: Exception playbooks | S | Yes |
| P1-025: Exception fields on Deviation | XS | Yes |
| P1-026: Exception listing API | S | After P1-025 |
| P1-027: Exception queue in cockpit | M | After P1-026 |

**Why this grouping**: Ingestion and exceptions are independent workstreams that can progress in parallel.

---

### Sprint 5 (Weeks 9-10): Dashboard v2 + Baselines

**Goal**: Executive dashboard with 30-second mode. Time baseline collection started.

| Ticket | Size | Parallel? |
|--------|------|-----------|
| P1-028: Dashboard summary endpoint | S | Yes |
| P1-029: Executive summary cards | M | After P1-028 |
| P1-030: "What needs attention" widget | M | After P1-028 |
| P1-031: Task taxonomy definition | S | Yes |
| P1-032: Task category on TimePunch | S | After P1-031 |
| P1-033: Time baseline reporting endpoint | M | After P1-032 |
| P1-034: Punch anomaly detection | S | After P1-032 |

**Why this grouping**: Dashboard v2 depends on blocked status (Sprint 2). Baselines depend on role clarity (Sprint 1) for clean punch data.

---

## 5. Phase 2 Epics

| Epic ID | Epic | Phase 2 focus |
|---------|------|--------------|
| P2-E1 | Evidence Collection & Analysis | Prerequisite for all other P2 work |
| P2-E2 | Menu & Navigation Simplification | Remove/hide unused menu items |
| P2-E3 | Page Consolidation | Merge pages that serve the same purpose |
| P2-E4 | API & Endpoint Consolidation | Reduce redundant endpoints |
| P2-E5 | Workflow Simplification | Reduce entry points and steps |

---

## 6. Phase 2 Tickets

### Epic P2-E1: Evidence Collection & Analysis

---

**P2-001: Generate per-role page visit report**
- Phase: 2
- Epic: P2-E1
- Type: Investigation
- Description: Query `PageVisit` table (from P1-014) and produce report: visits per page per role over 4 weeks. Identify zero-visit pages per role.
- Dependencies: P1-014 + 4 weeks of data
- Owner type: Product/Ops
- Size: S
- Evidence gate: **4 weeks of usage data after P1 Sprint 2 role filtering is live**
- Acceptance criteria: Report showing top/bottom pages per role with visit counts

---

**P2-002: Generate API route call frequency report**
- Phase: 2
- Epic: P2-E1
- Type: Investigation
- Description: Analyze Vercel function logs or add lightweight API call counter. Produce frequency report per route.
- Dependencies: 4 weeks of post-Phase 1 traffic
- Owner type: Infra
- Size: S
- Evidence gate: **4 weeks of API traffic logs**
- Acceptance criteria: Report showing call frequency per API route, sorted by usage

---

**P2-003: Conduct team feedback sessions**
- Phase: 2
- Epic: P2-E1
- Type: Investigation
- Description: 1:1 with one representative per role (woodworker, planner, owner, sales). Ask: "What do you never use? What confuses you? What takes too many clicks?"
- Dependencies: Phase 1 M2 complete + 2 weeks usage
- Owner type: Product/Ops
- Size: S
- Evidence gate: **2 weeks after role-filtered UI is live**
- Acceptance criteria: Documented feedback per role with specific page/feature references

---

**P2-004: Rank consolidation candidates**
- Phase: 2
- Epic: P2-E1
- Type: Investigation
- Description: Using P2-001, P2-002, P2-003, apply the remove/merge/hide decision tree from Phase 2 plan to each candidate. Produce ranked list with action + evidence.
- Dependencies: P2-001, P2-002, P2-003
- Owner type: Product/Ops
- Size: M
- Evidence gate: **All three reports complete**
- Acceptance criteria: Ranked table of candidates with decision (remove/merge/hide/keep) and evidence citation

---

### Epic P2-E2: Menu & Navigation Simplification

---

**P2-005: Remove `/purchasing` and `/structure` redirects**
- Phase: 2
- Epic: P2-E2
- Type: Implementation (safe)
- Description: Delete the redirect pages and remove from default menu config. Both are already redirects to other pages.
- Dependencies: P2-001 confirms zero direct visits
- Owner type: Frontend
- Size: XS
- Evidence gate: **4 weeks page visit data showing zero visits**
- Acceptance criteria: Routes removed; menu config updated; no broken links in codebase

---

**P2-006: Hide admin-only menu items for non-admin roles**
- Phase: 2
- Epic: P2-E2
- Type: Implementation (safe)
- Description: Items like `/settings/risk`, `/processes`, `#export` hidden for non-admin/planner roles. (If P1-011 already does this, this ticket is a verification pass.)
- Dependencies: P2-001
- Owner type: Frontend
- Size: XS
- Evidence gate: **Confirm via visit data that these pages have zero woodworker/sales visits**
- Acceptance criteria: Menu items hidden for confirmed non-user roles

---

### Epic P2-E3: Page Consolidation

---

**P2-007: Evaluate admin sub-pages as tabs**
- Phase: 2
- Epic: P2-E3
- Type: Investigation
- Description: Analyze whether `/admin/employees`, `/admin/stations`, `/admin/punches` should merge into tabs within `/admin`. Check session flow data for cross-navigation patterns.
- Dependencies: P2-001
- Owner type: Product/Ops
- Size: S
- Evidence gate: **Session flow data showing >50% of admin users visit 2+ sub-pages per session**
- Acceptance criteria: Decision document with merge/keep recommendation + evidence

---

**P2-008: Merge admin sub-pages into tabs (if validated)**
- Phase: 2
- Epic: P2-E3
- Type: Implementation (medium risk)
- Description: If P2-007 recommends merge: move employees, stations, punches into tabs within `/admin`. Keep old URLs as redirects for 4 weeks.
- Dependencies: P2-007 decision = merge
- Owner type: Frontend
- Size: L
- Evidence gate: **P2-007 decision document approved**
- Acceptance criteria: All admin sub-pages accessible as tabs; old URLs redirect; no broken bookmarks
- Caution: QR codes for punch stations link to `/punch/[station]`, not to admin pages. Verify no QR breakage.

---

**P2-009: Evaluate global costing page redundancy**
- Phase: 2
- Epic: P2-E3
- Type: Investigation
- Description: Determine if `/costing` (global) is used independently of project-level `CostsTab`. If all costing is project-scoped, the global page may be removable.
- Dependencies: P2-001
- Owner type: Product/Ops
- Size: S
- Evidence gate: **4 weeks usage data on `/costing` page**
- Acceptance criteria: Decision: keep / merge into project costs / remove

---

**P2-010: Evaluate service call entry point consolidation**
- Phase: 2
- Epic: P2-E3
- Type: Investigation
- Description: Service calls can be created from 3 places: `/service-calls`, project detail, AI. Determine which entry point each role actually uses.
- Dependencies: P2-001, P2-003
- Owner type: Product/Ops
- Size: S
- Evidence gate: **Per-role usage data + team feedback**
- Acceptance criteria: Decision on primary entry point per role; consolidation plan if warranted

---

### Epic P2-E4: API & Endpoint Consolidation

---

**P2-011: Dependency analysis for aggregate endpoints**
- Phase: 2
- Epic: P2-E4
- Type: Investigation
- Description: Map which UI components and server-side functions depend on `/api/dashboard`, `/api/ops/cockpit`, `/api/stats`. Determine if any can be merged without breaking consumers.
- Dependencies: P2-002
- Owner type: Backend
- Size: M
- Evidence gate: **API frequency report + codebase grep of all consumers**
- Acceptance criteria: Dependency map document per endpoint; merge/keep recommendation
- Caution: The observability engine (`recalculateProjectState`) cascades through multiple endpoints. Verify no recalculation chain is broken by consolidation.

---

**P2-012: Dependency analysis for inventory endpoints**
- Phase: 2
- Epic: P2-E4
- Type: Investigation
- Description: `/api/inventory` vs `/api/inventory-items` — map consumers, response shape differences, and whether one can absorb the other.
- Dependencies: P2-002
- Owner type: Backend
- Size: S
- Evidence gate: **API call frequency + consumer analysis**
- Acceptance criteria: Merge/keep recommendation with response shape comparison
- Caution: AI tools (`getInventoryStatus`, `searchInventory`) may depend on specific response shapes.

---

### Epic P2-E5: Workflow Simplification

---

**P2-013: Evaluate project creation wizard simplification**
- Phase: 2
- Epic: P2-E5
- Type: Investigation
- Description: The multi-step wizard may be over-complicated if the readiness gate (Phase 1) catches missing info later. Evaluate whether a simpler create flow + gate is better.
- Dependencies: P1-001, P1-002 enforced for 4+ weeks
- Owner type: Product/Ops
- Size: S
- Evidence gate: **4 weeks of readiness gate rejection data (P1-004)**
- Acceptance criteria: Decision: simplify wizard / keep as-is, with gate rejection evidence

---

**P2-014: Evaluate order creation flow consolidation**
- Phase: 2
- Epic: P2-E5
- Type: Investigation
- Description: Orders can be created manually, from cockpit shortages, or from AI. Determine if manual creation is used after Phase 1 cockpit + AI improvements.
- Dependencies: P2-002
- Owner type: Product/Ops
- Size: S
- Evidence gate: **API call frequency for `POST /api/orders` vs `POST /api/ops/purchase-draft` vs AI `createOrder`**
- Acceptance criteria: Decision on whether to remove manual order creation path

---

**P2-015: Evaluate cutlist tab consolidation**
- Phase: 2
- Epic: P2-E5
- Type: Investigation
- Description: `CutListTab` and `PrerequisitesTab` both handle cutlist-related data. Determine if they should merge.
- Dependencies: P2-003
- Owner type: Product/Ops
- Size: S
- Evidence gate: **Team feedback on which tab they use for cutlist work**
- Acceptance criteria: Decision: merge / keep separate, with user feedback evidence

---

**P2-016: Evaluate room-type form consolidation**
- Phase: 2
- Epic: P2-E5
- Type: Investigation
- Description: VanityTab, SideUnitTab, KitchenTab are separate components. Evaluate whether a generic room form with type-specific fields would be simpler.
- Dependencies: Baseline timing data (P1-033)
- Owner type: Product/Ops
- Size: S
- Evidence gate: **Time baseline data showing whether room-specific pricing is actually used**
- Acceptance criteria: Decision with pricing engine usage evidence
- Caution: Pricing engine (`src/lib/pricing/vanity.ts`, `sideUnit.ts`, `kitchen.ts`) has room-type-specific logic. Consolidating forms without consolidating pricing math creates misalignment.

---

## 7. Phase 2 Evidence Gates

| Ticket | Required evidence | Minimum period | Source |
|--------|------------------|----------------|--------|
| P2-001 | Page visit frequency by role | 4 weeks | `PageVisit` table (P1-014) |
| P2-002 | API route call frequency | 4 weeks | Vercel logs or middleware counter |
| P2-003 | Team feedback per role | 2 weeks after M2 | 1:1 sessions |
| P2-004 | All three reports above | After P2-001/002/003 | Synthesis |
| P2-005 | Zero direct visits to `/purchasing`, `/structure` | 4 weeks | P2-001 |
| P2-006 | Zero woodworker/sales visits to admin pages | 4 weeks | P2-001 |
| P2-007 | Cross-navigation patterns in admin | 4 weeks | P2-001 session flow |
| P2-008 | P2-007 merge decision approved | Decision doc | P2-007 |
| P2-009 | `/costing` page usage data | 4 weeks | P2-001 |
| P2-010 | Per-role service call entry point usage | 4 weeks + feedback | P2-001, P2-003 |
| P2-011 | API frequency + consumer dependency map | 4 weeks | P2-002 + codebase |
| P2-012 | API frequency + consumer analysis | 4 weeks | P2-002 + codebase |
| P2-013 | Readiness gate rejection rate | 4 weeks | P1-004 audit logs |
| P2-014 | Order creation path frequency | 4 weeks | P2-002 |
| P2-015 | Team feedback on cutlist tabs | Feedback session | P2-003 |
| P2-016 | Pricing engine usage + timing data | 4 weeks | P1-033 + codebase |

---

## 8. Phase 2 Sprint Plan

### Sprint P2-1 (Week 15-16): Evidence gathering

**Goal**: Collect and synthesize all evidence needed for Phase 2 decisions.

| Ticket | Type |
|--------|------|
| P2-001 | Investigation |
| P2-002 | Investigation |
| P2-003 | Investigation |
| P2-004 | Investigation |

---

### Sprint P2-2 (Week 17-18): Safe cuts + investigation

**Goal**: Execute zero-risk removals. Start deeper investigations.

| Ticket | Type |
|--------|------|
| P2-005 | Implementation (safe) |
| P2-006 | Implementation (safe) |
| P2-007 | Investigation |
| P2-009 | Investigation |
| P2-010 | Investigation |

---

### Sprint P2-3 (Week 19-20): Deeper evaluation + first consolidations

**Goal**: Complete remaining investigations. Execute validated consolidations.

| Ticket | Type |
|--------|------|
| P2-008 | Implementation (if validated) |
| P2-011 | Investigation |
| P2-012 | Investigation |
| P2-013 | Investigation |
| P2-014 | Investigation |
| P2-015 | Investigation |
| P2-016 | Investigation |

---

### Sprint P2-4 (Week 21-22): Evidence-based implementation

**Goal**: Execute remaining consolidations that passed investigation.

Tickets: determined by Sprint P2-3 investigation outcomes. Implementation tickets created only after evidence gates are satisfied.

---

## 9. Top 10 Highest-Leverage Tickets

| Rank | Ticket | Why |
|------|--------|-----|
| 1 | **P1-011**: Filter menu by role | Immediate adoption impact; hours of work |
| 2 | **P1-015**: Enable Neon PITR | Afternoon of work; prevents permanent data loss |
| 3 | **P1-005**: `blockedReason` schema field | XS effort; enables 5 downstream tickets |
| 4 | **P1-001**: Define readiness requirements | Prevents the #1 operational failure mode |
| 5 | **P1-016**: Health endpoint | XS effort; confirms deployment state remotely |
| 6 | **P1-002**: Enforce readiness gate | Makes the gate real instead of advisory |
| 7 | **P1-007**: Blocked badge on project lists | Makes blocked state visible without clicking |
| 8 | **P1-014**: Usage tracking middleware | Enables all Phase 2 decisions; must start early |
| 9 | **P1-028**: Dashboard summary endpoint | Powers executive 30-second view |
| 10 | **P1-020**: Ingestion pipeline design | Prevents the biggest future automation disaster |

---

## 10. Biggest Implementation Risks

1. **P1-013 (middleware role gating)**: Requires loading `User.role` from Neon on every request. If done via DB query, adds latency. Consider caching role in a signed cookie or short-TTL header after login. Test cold-start latency on Vercel.

2. **P1-006 (auto-block from deviations)**: The deviation engine cascades through 5 recalculation steps. Auto-setting `blockedReason` inside this chain could trigger re-renders or loops if `PATCH` triggers recalculation again. Add a guard: only set `blockedReason` if it changed.

3. **P1-022 (ingestion upload flow)**: Scope creep risk is high. Strictly limit to manual upload + parse + match + confirm. Do not build email polling, webhook listeners, or auto-apply in this ticket.

4. **P2-008 (admin tab merge)**: Punch station QR codes contain direct URLs. If URLs change, printed QR codes break. Must keep old URLs as redirects for at least 4 weeks after merge.

5. **P2-011 (aggregate endpoint consolidation)**: Three dashboards depend on three different aggregate endpoints. Merging them requires all three UIs to agree on a unified payload — or introduces a regression in one dashboard while fixing another.

6. **Phase 2 timing**: The strongest risk is starting Phase 2 too early because Phase 1 "feels done." Enforce the 4-week evidence collection period. No exceptions.

---

## 11. Final Recommendation

Copy Sprint 1 tickets into your board today. They are all safe wins with no dependencies:

- P1-010, P1-011, P1-012 (role filtering) — deliver in 2-3 days
- P1-015 (Neon backup) — 30 minutes in Neon dashboard
- P1-016 (health endpoint) — 1 hour of code
- P1-019 (uptime monitor) — 15 minutes in any monitoring service

That sprint alone will transform the team's daily experience and protect you from data loss. Everything after builds on that foundation.

Do not let the size of this board paralyze you. The first 6 tickets are the ones that matter most. Ship them, observe the reaction, then proceed to Sprint 2.

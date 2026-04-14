# Operations Maturity Roadmap — Scorecard

**Source of truth for maturity scoring.** For the full execution plan and prioritized backlog, see `/ROADMAP.md`.  
Last updated: 2026-04-14

> **Delta since 2026-04-09 review:** sales lifecycle stage, role-aware next-action spine, PDF invoice intake, ingredient/snapshot subsystem, and VanityTab section-canonical refactor all landed. Sections 1, 3, 4, 11, 13 rescored below.

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
- Active vs blocked vs completed distinction — partial (isDraft/isDone + blockedReason exist, but not surfaced as first-class dashboard filters)
- **Task assignment to employees per step — DOES NOT EXIST**
- **Step duration estimates — DOES NOT EXIST**
- **Daily task list per employee — DOES NOT EXIST**

**Score: 2 / 5** (was 3, downgraded — audit revealed task distribution is entirely missing)  
**Owner:** Planner  
**Actions:**
- Add `estimatedMinutes` and `defaultEmployeeRole` to `ProcessStep` schema
- Add `ProjectProcessStep` model (project-specific step instance with assignedEmployeeId, scheduledDate, status)
- Add assignment UI in Planner view (drag step onto employee/date)
- Surface blocked vs active as first-class dashboard grouping

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

**Score: 0 / 5** (was 1, downgraded — task taxonomy doesn't exist and punch data isn't task-tagged)  
**Owner:** Planner + Admin  
**Actions:**
- First: build `ProjectProcessStep` (Section 6 actions above) — punch data must be task-tagged to be useful
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

**Score: 4 / 5**  
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
- Role-specific interfaces simplified — NOT DONE (same UI for all roles)
- Woodworkers see only what they need — NOT DONE (no mobile task view)
- Planner/ops role manages flow without admin clutter — partial
- Owner/executive view fast — NOT DONE
- Sales enters data without breaking production logic — partial
- Admin can override safely with audit visibility ✓

**Score: 2 / 5** (was 3, downgraded — audit confirmed woodworker has no functional view, salesperson has no quote output)  
**Owner:** Admin  
**Actions:**
- Build woodworker "Today" view (task list + punch-in, mobile-first)
- Build salesperson "My Projects" view + PDF quote export
- Role-filter navigation menu by User.role
- Add role-specific landing page after login (woodworker → Today, planner → Cockpit, sales → My Projects, admin → Dashboard)

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

**Score: 3 / 5**  
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

## Current snapshot

| Section | Score | Delta vs last |
|---------|-------|--------------|
| 1. Core operational foundation | **2.5** | ↑ from 2 (sales stage lifecycle) |
| 2. Project intake | 3 | — |
| 3. Sales-to-production handoff | **3** | ↑ from 2 (stage handoff + planner gating) |
| 4. Email/document ingestion | **2** | ↑ from 1 (PDF drop-zone + heuristic pre-fill) |
| 5. Project matching | 2 | — |
| 6. Production workflow + task distribution | 2 | — |
| 7. QR station timing | 3 | — |
| 8. Standard time baselines | 0 | — |
| 9. Inventory + purchasing | 4 | — |
| 10. Cutlist integration | 3 | — |
| 11. Roles and permissions | 2 | — |
| 12. AI action system | 3 | — |
| 13. Dashboard usefulness | 3 | — (stage grouping + role-aware cards) |
| 14. Exception handling | 2 | — |
| 15. Training and adoption | 1 | — |
| 16. Commercialization readiness | 1 | — |
| **Overall average** | **2.3 / 5** | ↑ from 2.1 (sales lifecycle work moved the needle) |

**Review date:** 2026-04-14  
**Top 3 risks this cycle:**
1. Task distribution does not exist — woodworkers have no system-driven daily plan
2. Calendar is entirely disconnected from the project engine — production schedule is invisible on the calendar
3. Role-specific UX is incomplete — salesperson can't produce a quote, woodworker has no usable mobile view

**Top 3 actions before next review:**
1. Add `ProjectProcessStep` schema and assignment UI (unlocks task distribution + calendar integration + time baselines)
2. Build PDF quote export for salesperson
3. Build woodworker "Today" mobile view with task list + punch-in

---

## Review cadence and governance

- **Cadence:** Weekly for first 4 weeks after Tier 1 work begins, then bi-weekly
- **Participants:** Admin + Planner + one shop-floor representative
- **Rule:** Any section scoring < 3 must have an owner + target date before review ends
- **Rule:** Any section scoring 4+ needs at least one evidence artifact (screen, report, metric, or SOP)
- **Rule:** Do not begin lean refactor (PHASE_2_LEAN_REFACTOR_PLAN) until sections 1, 3, 6, 11 all reach 4+

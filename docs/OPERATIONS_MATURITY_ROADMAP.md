# Operations Maturity Roadmap

This document is your reliability checklist + maturity scorecard for WoodOps.
Use it as a recurring operating review (weekly or bi-weekly), not just a one-time planning note.

## How to use this roadmap

1. Score every section from `0` to `5` using the scale below.
2. Add 1-3 concrete actions per section that scored below `4`.
3. Assign an owner and a target date.
4. Re-score at the next review and track progress.

## Maturity scoring scale

- `0` = not defined
- `1` = defined in your head
- `2` = partly in the system
- `3` = works manually
- `4` = works reliably in the system
- `5` = works reliably and team uses it

## Priority 5 (must win first)

These five questions are the highest leverage right now:

1. Do we know the exact standard stages of a normal project?
2. Do we know the minimum information required before production can start?
3. Can the system reliably match invoices/emails/docs to the correct project?
4. Can the team update work status simply without friction?
5. Can we see blocked projects, missing materials, and next actions instantly?

---

## 1) Core operational foundation

Checklist:
- Main project types are clearly defined.
- Standard stages exist for each project type.
- Each stage is marked as mandatory or optional.
- Stage ownership is explicit by role/person.
- "Done" criteria exist for each stage.

**Score (0-5):** 2
**Owner:** Admin + Planner
**Actions:**
- Define canonical project types and stage templates in one source of truth (config + SOP).
- Add explicit stage owner + done criteria fields per stage.
- Make stage mandatory/optional machine-readable (not just convention).

## 2) Project intake standardization

Checklist:
- Minimum intake info set is defined.
- Unique project identity rule exists (client name vs invoice/project number/address/room).
- Duplicate client name handling exists.
- Revised orders/change-after-sale process exists.
- Incomplete intake flag exists and blocks progression where needed.

**Score (0-5):** 3
**Owner:** Sales + Admin
**Actions:**
- Lock minimum intake schema (job/invoice ref, client, address, scope, target date).
- Add explicit incomplete-intake blocker before production activation.
- Add duplicate-handling SOP for same client / revised sale cases.

## 3) Sales-to-production handoff

Checklist:
- A clear handoff moment exists.
- Required data for production start is explicit.
- Product descriptions are standardized enough for machine interpretation.
- Missing measurements/materials/finishes/accessories are flagged.
- System can block progression on missing required fields.

**Score (0-5):** 2
**Owner:** Sales + Planner
**Actions:**
- Introduce "ready for production" gate with required fields checklist.
- Add missing-info flags in project detail + dashboard.
- Enforce blocker when required handoff fields are absent.

## 4) Email and document ingestion

Checklist:
- Relevant email detection is reliable.
- System identifies invoice PDFs/confirmations/supplier docs.
- Parser extracts invoice #, supplier, reference, items, qty, dates.
- Parsed docs can be linked to projects with confidence thresholds.
- Human confirmation exists for low-confidence matches.
- Duplicate protection exists (same email/PDF cannot create duplicates).

**Score (0-5):** 1
**Owner:** Admin
**Actions:**
- Define ingestion pipeline states: received, parsed, matched, needs_review, applied.
- Add confidence scoring + human approval for low confidence.
- Add dedupe keys (message-id/hash/attachment hash) before auto actions.

## 5) Project matching logic

Checklist:
- Ranking logic exists for incoming-to-project matching.
- Invoice/project number outranks client name.
- Same-client multi-project ambiguity is handled.
- Multi-room/subproject matching is handled.
- System asks disambiguation questions when needed.

**Score (0-5):** 2
**Owner:** Admin + Planner
**Actions:**
- Implement weighted ranker (job/invoice > address > client > fuzzy name).
- Add mandatory disambiguation prompt when top match confidence is below threshold.
- Add subproject/room-level matching metadata.

## 6) Production workflow structure

Checklist:
- Workflow reflects real shop stages (not idealized flow only).
- Projects can move forward/backward safely.
- Holds/blocks are explicit (missing material, waiting approval, waiting cutlist, supplier delay).
- State distinction exists: active vs blocked vs completed.

**Score (0-5):** 3
**Owner:** Planner
**Actions:**
- Add explicit blocked reasons enum and SLA timers.
- Add backward transition reason logging.
- Surface blocked vs active clearly in dashboard defaults.

## 7) QR station timing system

Checklist:
- Each station has a clear purpose in the data model.
- Start/stop/switch task UX is simple.
- Time data quality can be evaluated (useful vs noisy).
- Reporting intent is clear: project, station, employee (or all).
- Tracking scope focuses on what improves estimate/schedule/pricing.

**Score (0-5):** 3
**Owner:** Shop Lead
**Actions:**
- Define allowed punch categories and invalid/noisy patterns.
- Add daily anomaly report (long open punch, missing station, rapid toggles).
- Define KPI set used for pricing/estimation updates.

## 8) Standard time baselines

Checklist:
- Top 10-20 repeatable tasks are defined.
- Timing collection is consistent.
- Average/range/outlier logic exists.
- Standard jobs are separated from custom exceptions.
- Task templates can be generated from historical timing.

**Score (0-5):** 1
**Owner:** Planner + Admin
**Actions:**
- Select first 10 repeatable tasks and define measurement protocol.
- Compute baseline metrics (avg/p50/p90/outliers) monthly.
- Tag custom exception jobs so they do not pollute baseline.

## 9) Inventory and purchasing logic

Checklist:
- Inventory naming and units are standardized.
- Sheet size/cost/supplier metadata is structured.
- Stable supplier mappings are known and encoded.
- Order suggestions can be generated from cutlist + stock.
- Uncertainty is surfaced (not silently guessed).
- Supplier/product mapping can be learned with confirmation.

**Score (0-5):** 4
**Owner:** Purchasing + Admin
**Actions:**
- Add confidence labels for supplier default resolution.
- Add confirmation loop to learn new supplier mappings.
- Add weekly catalog hygiene report (missing units/costs/thresholds).

## 10) Cutlist integration

Checklist:
- Project state can be "waiting for cutlist".
- Cutlist receipt is detectable.
- Cutlist can be linked to correct project.
- Material requirements can be derived from cutlist.
- Next step can be auto-triggered or approval-triggered.

**Score (0-5):** 3
**Owner:** Planner
**Actions:**
- Add explicit "waiting for cutlist" status at project/subproject level.
- Add confidence + confirmation for cutlist-to-project linking.
- Add next-step trigger rules (requirements recalculation + purchasing suggestion).

## 11) Roles and permissions

Checklist:
- Role-specific interfaces are simplified.
- Woodworkers see only what they need.
- Planner/ops role can manage flow without admin clutter.
- Owner/executive view is high-level and fast.
- Sales can enter data without breaking production logic.
- Admin can override safely with audit visibility.

**Score (0-5):** 3
**Owner:** Admin
**Actions:**
- Complete route-by-route role matrix (API + pages).
- Add UI-level visibility filters per role (not just API checks).
- Add override/audit trail for high-risk actions.

## 12) AI action system

Checklist (for each action):
- Frequently used.
- Saves real time.
- Safe with human approval.
- Explains intent before execution.
- Fails safely.

Must-have actions:
- Create/suggest project from email/invoice.
- Match incoming document to project.
- Flag missing information.
- Update project status.
- Suggest material orders.
- Draft supplier email.
- Answer project status quickly.
- Show blocked/overdue/stalled projects.

Nice-to-have later:
- Delivery routing.
- Scheduling optimization.
- Profitability forecasting.
- Voice memo logging.
- Weekly summary generation.

**Score (0-5):** 3
**Owner:** Admin + Planner
**Actions:**
- Add 3 missing must-haves: doc-to-project match, missing-info flagging, blocked/overdue summary action.
- Add action-level risk classes + approval policy by role.
- Add execution audit payload and rollback guidance per action.

## 13) Dashboard usefulness

Checklist:
- Active projects visible instantly.
- Blocked projects visible instantly.
- Current assignees/woodworker focus visible.
- Waiting-on-material list visible.
- "Needs ordering today" visible.
- Executive status understandable in under 30 seconds.

**Score (0-5):** 3
**Owner:** Owner + Planner
**Actions:**
- Add default executive mode (30-second summary cards).
- Promote blocked/overdue/needs-ordering as top-level widgets.
- Add per-role dashboard presets.

## 14) Exception handling

Checklist:
- Missing info path is explicit.
- Parser uncertainty path is explicit.
- Inconsistent product description handling exists.
- Weird supplier formatting has fallback handling.
- Sales omissions are recoverable.
- Mid-production change handling exists.

**Score (0-5):** 2
**Owner:** Admin + Planner
**Actions:**
- Add explicit exception states and queues (needs_info, low_confidence, changed_after_start).
- Add standardized recovery playbooks for top 5 exception types.
- Add owner + SLA per exception category.

## 15) Training and adoption

Checklist:
- New employee onboarding < 15 minutes for role-specific tasks.
- Woodworker workflow is self-serve.
- Planner workflow is independent.
- Error recovery path is obvious and low stress.
- One non-negotiable data entry rule is clear to everyone.

**Score (0-5):** 2
**Owner:** Admin
**Actions:**
- Create one-page SOP per role with 3 core tasks + 3 common mistakes.
- Define and publish one non-negotiable data entry rule.
- Run a 2-week adoption check with direct team feedback.

## 16) Commercialization readiness (later)

Checklist:
- System does not depend on one person’s memory.
- Another shop could understand workflows without custom explanation.
- Terms/statuses/logic are generalizable.
- Internal assumptions are documented and replaceable.

**Score (0-5):** 1
**Owner:** Admin (future product owner)
**Actions:**
- Start glossary + canonical status dictionary.
- Separate shop-specific assumptions from platform logic in docs/config.
- Identify 3 workflows to generalize first for external portability.

---

## Review cadence and governance

- **Cadence:** Weekly for 4 weeks, then bi-weekly.
- **Review participants:** Admin + Planner/Ops + one shop-floor representative.
- **Rule:** Any section with score `< 3` must have an owner + date before review ends.
- **Rule:** Any section with score `4+` needs at least one evidence artifact (screen, report, metric, or SOP).

## Current snapshot (fill this each review)

- **Review date:** 2026-03-26 (baseline prefill)
- **Overall average score:** 2.4 / 5 (estimated from current implementation)
- **Top 3 risks this cycle:**
  1. Document/email ingestion confidence + dedupe is not production-grade yet.
  2. Sales-to-production handoff rules are not fully enforced as hard blockers.
  3. Role-specific UI simplification is partial; API auth improved but UX partitioning still shallow.
- **Top 3 actions before next review:**
  1. Define and enforce minimum production-start intake schema.
  2. Implement ingestion confidence workflow with human confirmation + duplicate guardrails.
  3. Finalize route-role matrix and apply UI role presets for woodworker/planner/owner.

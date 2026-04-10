# Phase 2: Lean Refactor Plan (after Phase 1)
> **This is a supporting detail document.** The master backlog and priorities live in [`/ROADMAP.md`](../ROADMAP.md). Do not begin executing this plan until sections 1, 3, 6, and 11 of the maturity scorecard all reach 4+ AND 4 weeks of Phase 1 usage data have been collected.

## 1. Executive judgment

This document must not be executed until Phase 1 milestones M1 through M5 are complete and validated with at least 2 weeks of team usage data. Premature simplification will remove structures that only look redundant because enforcement, roles, and visibility have not yet made their purpose obvious.

The app currently has 24 pages, 101 API routes, and 53 Prisma models. Some of this is genuine complexity for a real operations platform. Some of it is builder-logic scaffolding that served its purpose during feature-first development. Phase 2 separates one from the other — but only after Phase 1 has clarified which structures the team actually depends on under enforced workflows and role-filtered views.

## 2. Why this must happen after Phase 1

Three specific reasons:

1. **Pages that seem unused may become essential once roles are filtered.** A woodworker who never saw the punch page because the menu was cluttered might use it daily once their view is simplified. Removing it before testing role-filtered adoption would be a mistake.

2. **Endpoints that seem redundant may be load-bearing for the deviation engine.** The observability layer (`recalculateProjectState` → financial → material → inventory → order risk) calls multiple models. Consolidating endpoints before understanding which recalculation paths are critical could silently break deviation accuracy.

3. **Workflows that seem scattered may reflect real shop complexity.** The fact that service calls can be created from `/service-calls`, from `/projects/[id]`, from the AI, and from the calendar is not necessarily a problem — it might reflect how different roles enter the same data from different contexts. Phase 1's role filtering will reveal whether multiple entry points are actually used or just confusing.

## 3. Signals to collect from Phase 1 before slimming

Before making any Phase 2 cut, collect these signals:

| Signal | How to measure | Minimum collection period |
|--------|---------------|--------------------------|
| Page visit frequency by role | Analytics or simple `/api/auth/me` + pathname logging | 4 weeks |
| API route call frequency | Server logs or lightweight middleware counter | 4 weeks |
| Features never touched after role filtering | Zero-visit pages/routes per role | 4 weeks |
| Exception types that never occur | Exception queue with zero entries after 4 weeks | 4 weeks |
| AI tools never called | AI function call log analysis | 4 weeks |
| Team feedback on "I never use this" | Direct 1:1 with each role representative | 2 weeks after M2 |
| Deviation types that never fire | Deviation table analysis by type | 4 weeks |
| Readiness gate fields that are always pre-filled | Gate rejection rate by field | 4 weeks |

Do not cut anything that lacks at least 4 weeks of usage data under Phase 1 conditions.

## 4. Lean refactor objectives

- Reduce cognitive load for each role by removing surfaces they do not use.
- Reduce maintenance burden by consolidating endpoints that serve the same purpose.
- Reduce navigation depth by merging pages that always appear together.
- Reduce state complexity by removing workflow paths that Phase 1 enforcement made unnecessary.
- Preserve all operational capability — leaner does not mean less capable.

## 5. Menu simplification opportunities

**Candidates to evaluate after Phase 1 data:**

| Current menu item | Hypothesis | Evidence needed |
|-------------------|-----------|-----------------|
| `/purchasing` | Redirects to `/distributors` already. Remove from menu. | Confirm zero direct visits. |
| `/structure` | Redirects to `/admin`. Remove from menu. | Confirm zero direct visits. |
| `/settings/risk` | Likely admin-only. Hide from non-admin roles. | Confirm only admin visits. |
| `/admin/stations`, `/admin/employees`, `/admin/punches` | Could be tabs within `/admin` instead of separate pages. | Measure if users navigate between them in a single session. |
| `/processes` | Likely admin + planner only. Hide from woodworker/sales. | Confirm no woodworker/sales visits. |
| `#export` (backup) | Should be admin-only menu item. | Already clear. |

**What NOT to remove prematurely:**
- `/home` (cockpit) and `/dashboard` may look duplicative but serve different roles (planner vs owner). Keep both until usage data confirms one is unused.
- `/inventory` and `/distributors` overlap in purchasing context but serve different entry points. Keep until consolidation evidence is clear.

## 6. Page consolidation opportunities

**Candidates to evaluate:**

| Pages | Consolidation hypothesis | Evidence needed |
|-------|------------------------|-----------------|
| `/admin/employees` + `/admin/stations` + `/admin/punches` | Merge into tabs within `/admin` | Session flow data showing users visit 2+ of these per session |
| `/distributors` + `/purchasing` | Already a redirect; kill `/purchasing` route entirely | Confirm no deep links to `/purchasing` |
| `/costing` (global) + project-level `CostsTab` | May be redundant if all costing is project-scoped | Usage data on global costing page |
| `/service-calls` (global) + project-level `ServiceCallsTab` | Both create service calls; may confuse roles | Role-filtered usage showing which entry point each role uses |

**What NOT to consolidate prematurely:**
- `/home` (cockpit) and `/dashboard` — different audiences, different data density.
- `/calendar` and `/service-calls` — calendar is time-oriented, service calls are project-oriented.
- `/assistant` and the floating `AiChatWidget` — dedicated page has history; widget is contextual.

## 7. Endpoint/API consolidation opportunities

**Candidates to evaluate:**

| Endpoints | Hypothesis | Risk of premature cut |
|-----------|-----------|----------------------|
| `/api/inventory` + `/api/inventory-items` | Two listing endpoints for overlapping data | Observability engine may depend on specific response shapes |
| `/api/settings/global` + `/api/admin/config` | Both store app-wide config | Config is typed AppConfig; settings is GlobalSettings. Merging requires schema migration. |
| `/api/dashboard` + `/api/ops/cockpit` + `/api/stats` | Three aggregate endpoints | Each feeds a different UI; consolidating requires all three UIs to agree on payload |
| `/api/service-calls` + `/api/projects/[id]/service-calls` | Global vs project-scoped | Global is used by `/service-calls` page and calendar; project-scoped by project detail. Both needed until entry points are consolidated. |
| Multiple `/api/projects/[id]/*` sub-routes | 20+ sub-routes under one project | Some (vanity, side-unit, kitchen inputs) are room-type-specific and may not all be used for every project type |

**Rule**: do not consolidate API routes until you have confirmed that no client-side code, AI tool, or observability function depends on the specific route or response shape.

## 8. Workflow simplification opportunities

**Candidates to evaluate:**

| Workflow | Simplification hypothesis | Prerequisite |
|----------|--------------------------|-------------|
| Project creation (wizard) | May be over-complicated if readiness gate catches missing info later | Phase 1 gate must be enforced first |
| Service call creation (3 entry points) | Consolidate to 1 primary + AI | Role usage data showing which entry point each role uses |
| Order creation (manual + cockpit + AI) | May reduce to cockpit + AI only | Usage data on manual order creation |
| Cutlist upload (CutListTab + PrerequisitesTab) | Confusing that two tabs handle related data | User feedback on which tab they actually use for cutlist work |
| Room input forms (Vanity, SideUnit, Kitchen) | May be replaced by a generic room form with type-specific fields | Only after baseline timing data shows whether room-specific pricing is actually used |

**What NOT to simplify prematurely:**
- The AI action approval flow. It is correctly designed as a safety layer. Do not collapse it into auto-execution.
- The deviation engine's multi-step recalculation. It looks complex but each step catches a different risk category.
- Process templates. The visual builder may seem heavy but it encodes real workflow knowledge.

## 9. Criteria for removing vs merging vs hiding

Use this decision tree for every candidate:

```
Is it visited by any role in Phase 1 usage data?
├── No → Is it referenced by server-side code (observability, AI, recalculation)?
│   ├── No → REMOVE (delete code + route + menu entry)
│   └── Yes → HIDE from UI but keep backend (mark as internal/system)
└── Yes → Is it visited by only one role?
    ├── Yes → KEEP but hide from other roles (role-filter only)
    └── No (multiple roles) → Is there another page/route that serves the same purpose better?
        ├── Yes → MERGE into the better surface, redirect the old URL
        └── No → KEEP as-is
```

Additional rules:
- Never remove a route that the AI tool system references without updating the tool definition.
- Never remove a model that the deviation engine writes to without confirming deviation accuracy is unaffected.
- Never remove a page that has a direct URL shared in team SOPs, bookmarks, or QR codes.

## 10. Milestones

| Milestone | Target | Prerequisite |
|-----------|--------|-------------|
| P2-M1: Usage data collection | Phase 1 M2 + 4 weeks | Role filtering live for 4 weeks |
| P2-M2: Consolidation candidates ranked | P2-M1 + 1 week | Usage report + team feedback collected |
| P2-M3: Menu slim | P2-M2 + 1 week | Top menu removals/hides agreed |
| P2-M4: Page consolidation | P2-M3 + 2 weeks | Per-page evidence reviewed |
| P2-M5: API consolidation | P2-M4 + 2 weeks | Dependency analysis complete |
| P2-M6: Workflow simplification | P2-M5 + 2 weeks | Workflow usage patterns confirmed |

## 11. Risks of over-cutting too early

1. **Removing a page that a role discovers only after Phase 1 filtering makes their view usable.** The page seemed unused because it was buried in admin clutter, not because it was unnecessary.

2. **Consolidating API routes that the deviation engine chains together.** The observability layer runs `recalculateProjectState` which cascades through 5 sub-calculations. Breaking any step silently degrades risk detection.

3. **Merging config models (`AppConfig` + `GlobalSettings` + `GlobalRiskSettings`)** before understanding which config surfaces are used by which roles. These models were split for a reason (even if the reason was builder convenience) and merging them requires careful migration.

4. **Removing room-type-specific input forms (Vanity, SideUnit, Kitchen)** before confirming whether the pricing engine actually produces useful estimates from them. If it does, removing them kills estimation. If it doesn't, they can go.

5. **Simplifying the AI tool list before Phase 1 adds the missing tools (ingestion, blocked-projects, missing-info).** The tool list should grow in Phase 1 and then be pruned in Phase 2 based on call frequency.

## 12. Final recommendation

Phase 2 is a scalpel, not a machete. Every cut must be justified by evidence collected during Phase 1. The correct default is to keep a structure until data proves it is unused, redundant, or actively confusing.

The single most important signal is **per-role page visit frequency under enforced workflows**. Collect it from day 1 of Phase 1 role filtering. Without it, every Phase 2 decision is guesswork.

Start Phase 2 planning only after Phase 1 milestones M1–M5 are complete and 4 weeks of usage data have been collected. Do not start earlier just because the code "feels" cluttered. Clutter that works is better than elegance that broke something.

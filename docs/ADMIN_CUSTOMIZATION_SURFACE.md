# Admin Customization Surface (Consolidation Audit)

Last updated: 2026-04-16

> **2026-04-16 delta:** Room-type → process-template mapping is now fully
> admin-editable under `/admin?tab=roomTypes`. The resolver
> (`src/lib/processDefaults.ts`) reads `AppConfig.processDefaults` first,
> then falls back to the built-in names (`vanity → Vanity`,
> `side_unit → Side Unit`, `kitchen → Kitchen`), then to the Kitchen
> template for anything else. The admin UI surfaces the fallback name
> per row so admins can predict behaviour when the override is empty.

## Goal

List all admin-level customization and behavior controls in the app and map them into one consolidated control surface.

## Consolidated Control Surface

- Primary page: `/admin?tab=behavior`
- Scope:
  - Global behavior defaults (markup, tax default, risk margin defaults)
  - Risk/deviation thresholds (recalculation-triggering controls)
  - Cross-links to the remaining admin customization tabs in `/admin`

## Existing Admin Customization Areas

### 1) App config customization (`/admin`, stored via `/api/admin/config`)

- **Company profile**: name, email, phone, address, logo, default employee rate
- **Navigation**: menu labels/order/visibility
- **Room types**: custom room types and default process per room
- **Construction standards**: cabinet/ingredient geometric defaults
- **AI intelligence**: material alias normalization map
- **Email templates**: supplier/client templates with variable tokens
- **Integrations**: Monday, Sage, IONOS and related secrets/state
- **System health + simulation**: diagnostics and admin impersonation tools

### 2) Global behavior settings (`/api/settings/global`)

- default markup
- risk threshold defaults
- default tax behavior/rate
- sheet format default

### 3) Risk settings (`/api/risk-settings`, legacy page `/settings/risk`)

- target/warning/high/critical margins
- waste factor
- inventory shortage threshold

### 4) Kitchen pricing behavior (new)

- Normalized kitchen pricing builder persistence and approvals:
  - `KitchenPricingProject` + cabinet/door/drawer/hardware/install tables
- Role-aware approval controls:
  - salesperson submit with default multiplier
  - non-default multiplier => planner/admin approval
  - admin remains unrestricted superuser
- API endpoints:
  - `GET/PATCH /api/projects/[id]/kitchen-builder`
  - `POST /api/projects/[id]/kitchen-builder/submit`
  - `POST /api/projects/[id]/kitchen-builder/approve`

## Consolidation Decision

- Keep all customization in `/admin` as the canonical admin hub.
- Route legacy risk settings entry (`/settings/risk`) to `/admin?tab=behavior`.
- Continue moving any future behavior controls into Admin Hub tabs to avoid split-brain settings.

## Follow-up Consolidation Work

1. Move kitchen pricing admin-editable coefficients from code constants into persisted admin config.
2. Add one permission matrix panel in Admin Hub documenting role capabilities for pricing visibility/actions.
3. Add an audit trail panel for behavior changes (who changed thresholds/markup and when).

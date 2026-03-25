# Auth & AI scheduling — manual test matrix

Run these after deploying with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set.

## Auth

| # | Case | Expected |
|---|------|----------|
| 1 | `/login` without session | Page loads |
| 2 | Any page except `/login` without session | Redirect to `/login?next=...` |
| 3 | Valid session, no Neon `User` row (no invite, not first user) | API returns 403 "No account" |
| 4 | First DB user (empty `User` table) | First login creates `admin` role |
| 5 | Invite flow: admin creates invite → user opens `/login?invite=TOKEN` → sign in → redeem | `User` created with invite role |
| 6 | `/onboarding` with `onboardingComplete=false` | Other routes redirect to `/onboarding` via `OnboardingGate` |
| 7 | Complete onboarding POST `/api/auth/onboarding` | `onboardingComplete=true`, redirect to `/` |
| 8 | Non-admin GET `/api/admin/config` | JSON without `integrations` secrets |
| 9 | Non-admin PATCH `/api/admin/config` | 403 |

## AI

| # | Case | Expected |
|---|------|----------|
| 10 | `POST /api/ai/chat` without session | 401 |
| 11 | `GET /api/ai/conversations` without session | 401 |
| 12 | Approve `scheduleServiceCall` as `woodworker` | 403 |
| 13 | Approve `scheduleServiceCall` as `planner` | `ServiceCall` + `DayPlanItem` created; `notificationDrafts` in response |
| 14 | Approve `createOrder` as `salesperson` | 403 (planner/admin only) |

## Calendar / day plan

| # | Case | Expected |
|---|------|----------|
| 15 | Day already has `DayPlanItem` rows; new service call scheduled | New item appended with `sortOrder` max+1 |

## Env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `NEXT_PUBLIC_APP_URL` | Optional; used in invite URLs (else `VERCEL_URL`) |
| `SERVICE_CALL_NOTIFY_EMAILS` | Optional comma-separated `mailto` recipients for team draft links |

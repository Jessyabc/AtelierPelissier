# Auth & AI scheduling — manual test matrix

Run these after deploying with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` set.

## Auth

| # | Case | Expected |
|---|------|----------|
| 1 | `/login` without session | Page loads | WORKS
| 2 | Any page except `/login` without session | Redirect to `/login?next=...` | WORKS
| 3 | Valid session, no Neon `User` row (no invite, not first user) | API returns 403 "No account" | WORKS
| 4 | First DB user (empty `User` table) | First login creates `admin` role | WORKS
| 5 | Invite flow: admin creates invite → user opens `/login?invite=TOKEN` → sign in → redeem | `User` created with invite role | The link it gives brings the user to the app, then the user uses his email, then is redirected on vercel and prompted to create a vercel project instead og going through our Atelier Pelissier onboarding
| 6 | `/onboarding` with `onboardingComplete=false` | Other routes redirect to `/onboarding` via `OnboardingGate` | Seems to work
| 7 | Complete onboarding POST `/api/auth/onboarding` | `onboardingComplete=true`, redirect to `/` | Works
| 8 | Non-admin GET `/api/admin/config` | JSON without `integrations` secrets | Uncertain as of now
| 9 | Non-admin PATCH `/api/admin/config` | 403 | Uncertain as of now

## AI

| # | Case | Expected |
|---|------|----------|
| 10 | `POST /api/ai/chat` without session | 401 | Works, Unauthorized
| 11 | `GET /api/ai/conversations` without session | 401 | Works, Unauthorized
| 12 | Approve `scheduleServiceCall` as `woodworker` | 403 |
| 13 | Approve `scheduleServiceCall` as `planner` | `ServiceCall` + `DayPlanItem` created; `notificationDrafts` in response |
| 14 | Approve `createOrder` as `salesperson` | 403 (planner/admin only) |
| 15 | Ask assistant “What is tomorrow’s schedule?” | Assistant calls `getDaySchedule` and answers from real events (no guessing) |
| 16 | Ask assistant “What’s on my schedule this week?” | Assistant calls `getScheduleRange` and summarizes by day |
| 17 | Ask assistant “What do we need to do for the Rachel Sapin service call?” | Assistant calls `getServiceCallDetails` and summarizes `workItems` (the list you entered) |
| 18 | Ask assistant: “Add a service call for Jessy’s project… (but no project exists)” | Assistant proposes `proposeCreateDraftProjectAndServiceCall`; on approve it creates draft project + unscheduled service call + workItems |

## Calendar / day plan

| # | Case | Expected |
|---|------|----------|
| 19 | Day already has `DayPlanItem` rows; new service call scheduled | New item appended with `sortOrder` max+1 |

## Env

| Variable | Purpose |
|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (publishable) key |
| `NEXT_PUBLIC_APP_URL` | Optional; used in invite URLs (else `VERCEL_URL`) |
| `SERVICE_CALL_NOTIFY_EMAILS` | Optional comma-separated `mailto` recipients for team draft links |

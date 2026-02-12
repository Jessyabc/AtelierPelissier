# Atelier Pelissier — Improvement Roadmap

Prioritized ideas to improve the app greatly. Pick by impact and effort.

---

## 🔴 High impact (do first)

### 1. **Printable / PDF quote**
- **Why:** Clients expect a formal estimate. Right now there’s no “give this to the client” output.
- **What:** Add a “Print quote” or “Download PDF” on the project (or Costs tab) that shows: project name, client, types, cost summary (estimate vs actual), tax, total. Either browser print (window.print) with a print-only CSS layout or a simple PDF (e.g. jsPDF or a server route that generates PDF).
- **Effort:** Medium.

### 2. **Search and filter on dashboard**
- **Why:** With many projects, finding one is painful.
- **What:** Search by project name or client name; filter by type (Vanity / Side Unit / Kitchen), status (Draft / Saved), date range. Keep it client-side at first (filter the list you already fetch).
- **Effort:** Low–medium.

### 3. **Error boundaries**
- **Why:** One broken component (e.g. in a tab) can white-screen the whole app.
- **What:** Wrap the app (or at least the main content and each tab content) in React error boundaries. Show “Something went wrong” + Retry instead of a blank page.
- **Effort:** Low.

### 4. **Toast / notification system**
- **Why:** “Saved” and errors are easy to miss when they’re inline.
- **What:** Global toasts for: “Project saved”, “Client info saved”, “Failed to save”, etc. Use a tiny library (e.g. react-hot-toast or sonner) or a minimal custom hook + fixed container.
- **Effort:** Low.

### 5. **Delete project (with confirmation)**
- **Why:** No way to remove test or old projects.
- **What:** “Delete project” on project page (and optionally on dashboard cards). Confirm modal: “Delete [name]? This can’t be undone.” Call `DELETE /api/projects/[id]` then redirect to dashboard.
- **Effort:** Low.

### 6. **Duplicate project**
- **Why:** Similar jobs = retype everything.
- **What:** “Duplicate” on project or dashboard. Clone project (name + “ (copy)”), same types, client, settings, vanity/side unit/kitchen inputs, cost lines. New draft.
- **Effort:** Medium.

### 7. **Better validation and error messages**
- **Why:** “Validation failed” or “Failed to load” don’t say what’s wrong.
- **What:** API returns field-level errors (e.g. `{ issues: { clientEmail: ["Invalid email"] } }`). Forms show errors under each field. Required client fields when saving project: show which ones are missing by name.
- **Effort:** Low–medium.

### 8. **Mobile-friendly layout**
- **Why:** Quotes are often done on-site or on a tablet.
- **What:** Responsive dashboard (cards stack, touch-friendly), project page tabs as dropdown or drawer on small screens, forms that don’t overflow, bigger tap targets.
- **Effort:** Medium.

---

## 🟡 Medium impact (next wave)

### 9. **Loading skeletons**
- Replace “Loading dashboard…” with skeleton cards so the layout doesn’t jump and feels faster.

### 10. **Sort dashboard**
- Sort by: last updated, name, client, estimate total. Toggle asc/desc.

### 11. **Export / backup**
- Export all projects (or filtered) as JSON or CSV so data isn’t locked in one machine. Optional: import back.

### 12. **Accessibility basics**
- Skip link to main content, focus management when opening modals/tabs, aria-labels on icon-only buttons, ensure focus isn’t trapped. One `alt` on logo is a start; extend to forms and actions.

### 13. **Dark / light theme**
- You already have brand colors. Add a theme toggle or follow `prefers-color-scheme` so the app is comfortable in different environments.

### 14. **Protect the API (if deployed)**
- If the app is on a server others can reach: add simple auth (e.g. NextAuth or a single shared password) and optionally rate limiting so the API isn’t open to the world.

---

## 🟢 Nice to have

- **Email quote to client** – Send PDF or link by email (needs email service).
- **Dashboard summary** – Total $ in estimates this month, number of drafts, etc.
- **Simple charts** – Estimate totals over time or by project type.
- **French (i18n)** – If Atelier Pelissier is Quebec-based, French UI (or FR/EN toggle) would align with the brand.
- **Audit / history** – Log key changes (e.g. “Project saved”, “Estimate updated”) for accountability.

---

## Quick wins you can do in one sitting

1. **Error boundary** around main content and show “Something went wrong” + Retry.
2. **Delete project** with confirmation modal and `DELETE /api/projects/[id]`.
3. **Toasts** for save success/failure (e.g. react-hot-toast).
4. **Dashboard search** – single input that filters project name + client name (client-side).
5. **Print quote** – new route or tab “Quote” that renders a print-only view (project + client + costs) and `window.print()`.

If you tell me which 1–2 items you want to do first (e.g. “PDF quote + delete project”), I can outline or implement them step by step in your repo.

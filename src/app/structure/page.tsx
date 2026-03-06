"use client";

import Link from "next/link";

const ROUTES = [
  { path: "/", label: "Projects", desc: "Main dashboard: project list (drafts, saved, done), search, filters, estimates" },
  { path: "/projects/new", label: "New project", desc: "Create project: invoice#, types, clients (search/create), process template" },
  { path: "/projects/[id]", label: "Project detail", desc: "Project Board, tabs: Vanity, Side Unit, Kitchen, CutList, Costs, Quote, Service Calls, Client, Settings, History" },
  { path: "/dashboard", label: "Executive Dashboard", desc: "Snapshot, deviations, margin/cost variance, inventory alerts, backorders" },
  { path: "/processes", label: "Processes", desc: "Process templates list (create, duplicate)" },
  { path: "/processes/[id]", label: "Process builder", desc: "Flowchart editor for workflow steps" },
  { path: "/inventory", label: "Inventory", desc: "Stock overview, thresholds, add/edit items" },
  { path: "/purchasing", label: "Purchasing", desc: "Orders, status, receive items, backorder management" },
  { path: "/costing", label: "Costing", desc: "Vendor invoices, map lines to projects" },
  { path: "/service-calls", label: "Service calls", desc: "List, create, print, calendar link" },
  { path: "/calendar", label: "Calendar", desc: "Day plan, service calls, manual events" },
  { path: "/distributors", label: "Distributors", desc: "Supplier contacts" },
  { path: "/settings/risk", label: "Risk settings", desc: "Margin thresholds, waste factor" },
  { path: "/home", label: "Home", desc: "Landing / intro" },
];

export default function StructurePage() {
  return (
    <div className="max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">App Structure & Wireframe</h1>
        <p className="text-gray-600">Visual guide to routes, flow, and how everything connects.</p>
      </div>

      {/* Wireframe: Main layout */}
      <section className="neo-card p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Global layout</h2>
        <div className="font-mono text-sm text-gray-700 space-y-2">
          <div className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50">
            <div className="text-xs text-gray-500 mb-2">AppHeader (logo + hamburger menu)</div>
            <div className="h-8 bg-gray-200 rounded flex items-center px-2">
              [Logo] [≡ Menu → Home | Projects | Dashboard | New project | … | Export]
            </div>
          </div>
          <div className="border-2 border-gray-300 rounded-lg p-6 min-h-[400px]">
            <div className="text-xs text-gray-500 mb-2">Main content area (children)</div>
            <p className="text-gray-500 italic">Page content renders here</p>
          </div>
        </div>
      </section>

      {/* Wireframe: Key pages */}
      <section className="neo-card p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Page wireframes</h2>
        <div className="space-y-8">
          {/* Projects list */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">/ (Projects)</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs bg-white">
              <div className="flex gap-2 mb-3">
                <span className="px-2 py-1 bg-gray-200 rounded">[Search]</span>
                <span className="px-2 py-1 bg-gray-200 rounded">[All|Drafts|Saved|Done|Estimates]</span>
              </div>
              <div className="space-y-1">
                {["Project card 1 (name, client, status, estimate)", "Project card 2", "Project card 3", "…"].map((s, i) => (
                  <div key={i} className="p-2 border border-gray-200 rounded bg-gray-50">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Project detail */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">/projects/[id] (Project detail)</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs bg-white">
              <div className="mb-3">
                <div className="font-medium">[Project name] [Draft] [Done ✓] [Add task] [Duplicate] [Delete]</div>
                <div className="text-gray-500">Dashboard / Parent → Project</div>
              </div>
              <div className="border border-gray-200 rounded p-3 mb-3 bg-amber-50/50">
                <strong>Project Board</strong>
                <div className="mt-2 space-y-1 text-gray-600">
                  <div>▸ [Project workflow] 3/12 · Current: Ordering</div>
                  <div>▸ [Vanity] Main bath 2/8 · Current: Cut</div>
                  <div>▸ [Follow-up] B/O return 1/3</div>
                  <div className="text-xs">+ Add deliverable | + Add follow-up task</div>
                </div>
              </div>
              <div className="flex gap-1 flex-wrap mb-2">
                {["Vanity", "Side Unit", "Kitchen", "CutList", "Costs", "Quote", "Service Calls", "Client", "Settings", "History"].map((t) => (
                  <span key={t} className="px-2 py-0.5 border rounded text-gray-600">{t}</span>
                ))}
              </div>
              <div className="p-4 border border-gray-200 rounded bg-gray-50 min-h-[120px]">
                [Active tab content: Vanity config, costs, etc.]
              </div>
            </div>
          </div>

          {/* New project */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">/projects/new</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs bg-white flex gap-4">
              <div className="flex-1 space-y-3">
                <div>[Invoice / Job #] [Project description]</div>
                <div>[Project type: Vanity ✓ Side Unit Kitchen]</div>
                <div>[Process template ▼]</div>
                <div className="border p-3 rounded">
                  <strong>Primary client</strong>
                  <div>[Search | New] [Name, email, phone, phone2, address]</div>
                </div>
                <div>☐ Add second client</div>
                <div>[Tasks…] [Create] [Cancel]</div>
              </div>
              <div className="w-64 border-l pl-4">
                <strong>Tips</strong>
                <ul className="mt-2 text-gray-600 space-y-2">
                  <li>• Invoice / Job number</li>
                  <li>• Find existing clients</li>
                  <li>• Multiple clients</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Purchasing */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">/purchasing</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs bg-white">
              <div className="mb-3 p-2 bg-amber-100 rounded">⚠ Backordered: 2 orders</div>
              <div className="space-y-2">
                <div className="p-2 border rounded">Order card: supplier, status, lines, [Edit] [Receive]</div>
                <div className="p-2 border rounded">Order card 2</div>
                <div className="text-gray-500">+ New order</div>
              </div>
            </div>
          </div>

          {/* Dashboard */}
          <div>
            <h3 className="font-medium text-gray-700 mb-2">/dashboard</h3>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 font-mono text-xs bg-white">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                {["Projects", "Active", "Deviations", "Backordered"].map((l) => (
                  <div key={l} className="p-2 border rounded text-center">{l}<br/><span className="font-bold">12</span></div>
                ))}
              </div>
              <div className="border rounded p-2 mb-2">Deviations list (margin, cost, inventory)</div>
              <div className="border rounded p-2">Projects blocked by backorders</div>
            </div>
          </div>
        </div>
      </section>

      {/* Routes table */}
      <section className="neo-card p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">All routes</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 font-medium text-gray-700">Path</th>
                <th className="text-left py-2 font-medium text-gray-700">Label</th>
                <th className="text-left py-2 font-medium text-gray-700">Description</th>
              </tr>
            </thead>
            <tbody>
              {ROUTES.map((r) => {
                const href = r.path.includes("[id]") ? null : r.path;
                return (
                <tr key={r.path} className="border-b border-gray-100 hover:bg-gray-50/50">
                  <td className="py-2 font-mono text-gray-800">
                    {href ? (
                      <Link href={href} className="text-[var(--accent-hover)] hover:underline">{r.path}</Link>
                    ) : (
                      r.path
                    )}
                  </td>
                  <td className="py-2 font-medium">{r.label}</td>
                  <td className="py-2 text-gray-600">{r.desc}</td>
                </tr>
              );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* Flow diagram */}
      <section className="neo-card p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Flow (how pages connect)</h2>
        <div className="text-sm text-gray-700 space-y-2">
          <div className="font-mono p-4 bg-gray-50 rounded-lg overflow-x-auto">
            <pre>{`
                    ┌─────────────┐
                    │   /home     │  Landing
                    └──────┬──────┘
                           │
    ┌──────────────────────┼──────────────────────┐
    │                      │                      │
    ▼                      ▼                      ▼
┌──────────┐        ┌──────────────┐        ┌───────────────┐
│  /       │◄──────│ projects/new │       │   /dashboard   │
│ Projects │──────►│              │       │ (Executive)    │
└────┬─────┘        └──────────────┘       └───────┬────────┘
     │                       │                     │
     │  projects/[id]        │                     │
     ▼                       │                     │
┌────────────────────────────┐                    │
│   Project detail           │◄───────────────────┘
│  • Project Board            │
│  • Vanity | Side | Kitchen  │
│  • CutList | Costs | Quote  │
│  • Service Calls | Client   │
│  • Settings | History       │
└────┬───────────┬────────────┘
     │           │
     │           │ process template
     │           ▼
     │      ┌───────────┐     ┌─────────────┐
     │      │/processes │────►│ processes/  │
     │      │  (list)   │     │ [id] builder│
     │      └───────────┘     └─────────────┘
     │
     ├──────────────────┬────────────────────┐
     ▼                  ▼                    ▼
┌───────────┐    ┌────────────┐    ┌─────────────────┐
│/purchasing│    │/inventory │    │ /service-calls  │
│  Orders   │    │   Stock    │    │  + /calendar    │
└───────────┘    └────────────┘    └─────────────────┘
     │                  │                    │
     └──────────────────┴────────────────────┘
                        │
                        ▼
               ┌────────────────┐
               │  /costing       │  Vendor invoices
               │  /distributors  │  Supplier contacts
               │  /settings/risk │  Thresholds
               └────────────────┘
`}</pre>
          </div>
        </div>
      </section>

      {/* Data flow */}
      <section className="neo-card p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">Core data flow</h2>
        <div className="grid gap-4 sm:grid-cols-2 text-sm">
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-2">Project lifecycle</h3>
            <ol className="list-decimal list-inside space-y-1 text-gray-600">
              <li>Create project (invoice#, clients)</li>
              <li>Assign process → workflow seeded</li>
              <li>Add deliverables (vanity, kitchen…)</li>
              <li>Configure Vanity/Side/Kitchen</li>
              <li>CutList → material requirements</li>
              <li>Create orders (Purchasing)</li>
              <li>Receive → inventory, cost allocation</li>
              <li>Service calls, follow-ups</li>
            </ol>
          </div>
          <div className="p-4 border border-gray-200 rounded-lg">
            <h3 className="font-medium text-gray-700 mb-2">Key entities</h3>
            <ul className="space-y-1 text-gray-600">
              <li><strong>Project</strong> → Client(s), ProjectItems, TaskItems, Orders</li>
              <li><strong>ProcessTemplate</strong> → steps for workflow seeding</li>
              <li><strong>Client</strong> → reusable, searchable</li>
              <li><strong>Order</strong> → lines, backorder fields</li>
              <li><strong>Inventory</strong> → stock, thresholds</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  );
}

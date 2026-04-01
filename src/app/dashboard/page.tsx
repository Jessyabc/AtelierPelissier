"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DashboardSnapshot } from "@/components/dashboard/DashboardSnapshot";
import { DeviationPanel } from "@/components/dashboard/DeviationPanel";
import { ProjectDrilldown } from "@/components/dashboard/ProjectDrilldown";
import { BlockedReasonBadge } from "@/components/BlockedReasonBadge";

type Project = {
  id: string;
  name: string;
  type: string;
  types: string;
  isDraft: boolean;
  blockedReason?: string | null;
  costLines: Array<{ kind: string; amount: number }>;
  projectSettings?: { markup: number } | null;
  materialRequirements: Array<{ materialCode: string; requiredQty: number; allocatedQty: number }>;
  orders: Array<{ id: string; supplier: string; status: string }>;
  deviations: Array<{ type: string; severity: string; message: string }>;
};

type DashboardData = {
  totalProjects: number;
  activeProjects: number;
  projectsWithDeviations: number;
  avgMargin: number;
  totalCostVariance: number;
  inventoryBelowThreshold: number;
  openOrders: number;
  backorderedOrdersCount?: number;
  projectsBlockedByBackorder?: string[];
  projects: Project[];
};

type Deviation = {
  id: string;
  type: string;
  severity: string;
  groupKey: string | null;
  message: string;
  impactValue: number | null;
  projectId: string | null;
  project?: { id: string; name: string } | null;
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [deviations, setDeviations] = useState<Deviation[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedProject, setExpandedProject] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "drafts" | "saved">("all");
  const [search, setSearch] = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [dashboardRes, deviationsRes] = await Promise.all([
          fetch("/api/dashboard"),
          fetch("/api/dashboard/deviations"),
        ]);
        if (dashboardRes.ok) {
          const d = await dashboardRes.json();
          setData(d);
        }
        if (deviationsRes.ok) {
          const dev = await deviationsRes.json();
          setDeviations(dev);
        }
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="neumorphic-panel p-6">
        <p className="text-gray-600">Loading executive dashboard…</p>
      </div>
    );
  }

  const projects = data?.projects ?? [];
  const q = search.trim().toLowerCase();
  const filtered = projects
    .filter((p) => filter === "drafts" ? p.isDraft : filter === "saved" ? !p.isDraft : true)
    .filter((p) => !q || p.name.toLowerCase().includes(q));

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Executive Dashboard</h1>
        <p className="mt-1 text-sm text-gray-500">
          Observability layer — deviations and project health
        </p>
      </div>

      {data && (
        <section>
          <h2 className="mb-4 text-lg font-medium text-gray-800">Executive snapshot</h2>
          <DashboardSnapshot data={data} />
        </section>
      )}

      {data && (data.projectsBlockedByBackorder?.length ?? 0) > 0 && (
        <section className="neo-card p-4 severity-medium border-l-4 border-amber-500">
          <h2 className="mb-2 text-sm font-semibold text-amber-800">Projects blocked by backorders</h2>
          <ul className="text-sm text-amber-700">
            {data.projectsBlockedByBackorder!.map((projectId) => {
              const project = data.projects.find((p) => p.id === projectId);
              return (
                <li key={projectId}>
                  <Link
                    href={`/projects/${projectId}`}
                    className="text-amber-800 underline hover:no-underline"
                  >
                    {project?.name ?? projectId}
                  </Link>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 text-xs text-amber-600">
            These projects have orders marked as backordered. Check Purchasing for details.
          </p>
        </section>
      )}

      <section>
        <h2 className="mb-4 text-lg font-medium text-gray-800">Grouped deviations</h2>
        <DeviationPanel deviations={deviations} />
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-center gap-4">
          <h2 className="text-lg font-medium text-gray-800">Project drilldown</h2>
          <div className="flex gap-2">
            {(["all", "drafts", "saved"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={filter === f ? "neo-btn-pressed px-4 py-2 text-sm font-medium text-[var(--accent-hover)]" : "neo-segment-btn"}
              >
                {f === "all" ? "All" : f === "drafts" ? "Drafts" : "Saved"}
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search projects…"
            className="ml-auto rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
        </div>
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <p className="text-sm text-gray-500">No projects match the filter.</p>
          ) : (
            filtered.map((project) => (
              <div key={project.id}>
                <button
                  type="button"
                  onClick={() =>
                    setExpandedProject((p) => (p === project.id ? null : project.id))
                  }
                  className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 py-3 text-left hover:bg-gray-50"
                >
                  <span className="flex flex-wrap items-center gap-2 font-medium text-gray-900">
                    {project.name}
                    {project.blockedReason && <BlockedReasonBadge reason={project.blockedReason} />}
                  </span>
                  <span className="text-sm text-gray-500">
                    {expandedProject === project.id ? "▼" : "▶"}
                  </span>
                </button>
                {expandedProject === project.id && (
                  <div className="mt-2 pl-2">
                    <ProjectDrilldown project={project} />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

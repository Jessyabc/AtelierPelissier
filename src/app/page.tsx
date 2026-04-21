"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { HomeStats, type StatsData } from "@/components/HomeStats";
import { ProjectCard, type ProjectCardProject } from "@/components/ProjectCard";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { roleDisplayName } from "@/lib/workflow/nextAction";
import {
  getNewItemLabels,
  getStageView,
  isQuote as isQuoteStageHelper,
  isDraftProject as isDraftProjectHelper,
  isActiveProject as isActiveProjectHelper,
} from "@/lib/projectStage";

type Project = ProjectCardProject & {
  id: string;
  name: string;
  type: string;
  types: string;
  isDraft: boolean;
  isDone: boolean;
  updatedAt: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  costLines: Array<{ amount: number }>;
  subProjects?: Array<{ id: string; name: string; isDone: boolean; isDraft: boolean }>;
  blockedReason?: string | null;
  stage?: "quote" | "invoiced" | "confirmed" | null;
  depositReceivedAt?: string | null;
  archivedAt?: string | null;
  lostReason?: string | null;
};

const LOAD_TIMEOUT_MS = 8000;

/**
 * Filter chips reflect the canonical stage taxonomy (see lib/projectStage.ts).
 * Archived/lost projects are hidden from every chip EXCEPT "archived" so
 * default views stay focused on live work.
 */
type FilterKind = "all" | "quotes" | "invoices" | "active" | "done" | "archived";

const FILTER_LABEL: Record<FilterKind, string> = {
  all: "All",
  quotes: "Quotes",
  invoices: "Invoices",
  active: "Active",
  done: "Done",
  archived: "Archived",
};

const FILTERS: readonly FilterKind[] = [
  "all",
  "quotes",
  "invoices",
  "active",
  "done",
  "archived",
] as const;

function filterProjects(
  projects: Project[],
  search: string,
  filter: FilterKind
): Project[] {
  const q = search.trim().toLowerCase();
  let list = projects;
  if (q) {
    list = list.filter((p) => {
      const name = p.name.toLowerCase();
      const client = [p.clientFirstName, p.clientLastName].filter(Boolean).join(" ").toLowerCase();
      return name.includes(q) || client.includes(q);
    });
  }

  // All chips except "archived" hide archived/lost by default — operators
  // should have to click "Archived" to see them.
  if (filter !== "archived") {
    list = list.filter((p) => !p.archivedAt && !p.lostReason);
  }

  if (filter === "quotes") return list.filter(isQuoteStageHelper);
  if (filter === "invoices") return list.filter(isDraftProjectHelper);
  if (filter === "active") return list.filter(isActiveProjectHelper);
  if (filter === "done") return list.filter((p) => p.isDone);
  if (filter === "archived") {
    return list.filter((p) => Boolean(p.archivedAt) || Boolean(p.lostReason));
  }
  return list; // "all"
}

/** Pre-deposit work for the salesperson: quotes + issued invoices awaiting deposit. */
function isQuoteStage(p: Project): boolean {
  const view = getStageView(p);
  return view === "quote" || view === "draft_project";
}

export default function ProjectsPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const role = user?.role ?? "admin";
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);

  // Single load: fetch projects and stats in parallel
  useEffect(() => {
    setError(null);
    setLoading(true);
    const projectsUrl = typeof window !== "undefined" ? `${window.location.origin}/api/projects` : "/api/projects";
    const ac = new AbortController();
    Promise.all([
      fetch(projectsUrl, { signal: ac.signal }).then((r) => {
        if (!r.ok) throw new Error("Failed to load projects");
        return r.json();
      }),
      fetch("/api/stats", { signal: ac.signal }).then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([projectsData, statsData]) => {
        setProjects(Array.isArray(projectsData) ? projectsData : []);
        if (statsData) setStats(statsData);
        setError(null);
      })
      .catch((err) => {
        if (err?.name !== "AbortError") {
          setProjects([]);
          setError(
            err?.message === "Failed to load projects" || err?.message?.includes("aborted")
              ? "Request timed out"
              : (err as Error)?.message || "Failed to load"
          );
        }
      })
      .finally(() => setLoading(false));
    const t = setTimeout(() => ac.abort(), LOAD_TIMEOUT_MS);
    return () => {
      clearTimeout(t);
      ac.abort();
    };
  }, [retryKey]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => setSlowHint(true), 2500);
    return () => clearTimeout(t);
  }, [loading]);

  useEffect(() => {
    if (!loading) return;
    const t = setTimeout(() => {
      setError("Loading took too long. Try Retry or start a new entry.");
      setLoading(false);
    }, LOAD_TIMEOUT_MS + 2000);
    return () => clearTimeout(t);
  }, [loading]);

  const onRetry = () => {
    setSlowHint(false);
    setRetryKey((k) => k + 1);
  };

  // Role-aware "new item" wording — "New quote" for salespeople, "New project"
  // for everyone else. The destination is the same wizard.
  const newItemLabels = getNewItemLabels(role);

  const filtered = filterProjects(projects, search, filter);
  // Quick quotes (and invoiced-but-no-deposit) are shown in their own section
  // and excluded from Ongoing/Drafts so the salesperson queue is isolated
  // from the confirmed production pipeline.
  const quotes = filtered.filter(isQuoteStage);
  const drafts = filtered.filter((p) => p.isDraft && !isQuoteStage(p));
  const ongoing = filtered.filter((p) => !p.isDraft && !p.isDone && !isQuoteStage(p));
  const done = filtered.filter((p) => p.isDone);
  const archivedOrLost = filtered.filter((p) => Boolean(p.archivedAt) || Boolean(p.lostReason));

  async function handleDelete(projectId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Project deleted");
      setDeleteId(null);
      setRetryKey((k) => k + 1);
    } catch {
      toast.error("Failed to delete project");
    }
  }

  async function handleDuplicate(projectId: string) {
    setDuplicateId(projectId);
    try {
      const res = await fetch("/api/projects/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Duplicate failed");
      toast.success("Project duplicated");
      setDuplicateId(null);
      router.push(`/projects/${data.id}`);
    } catch {
      toast.error("Failed to duplicate project");
      setDuplicateId(null);
    }
  }

  if (loading) {
    return (
      <div className="neo-card p-6 sm:p-8">
        <p className="text-gray-600">Loading dashboard…</p>
        {slowHint && (
          <p className="mt-3 text-sm text-gray-500">
            Taking a while?{" "}
            <button type="button" onClick={onRetry} className="neo-btn px-3 py-1.5 text-sm">
              Retry
            </button>{" "}
            or{" "}
            <Link href="/projects/new" className="text-[var(--accent-hover)] hover:underline">
              create a new project
            </Link>
            .
          </p>
        )}
      </div>
    );
  }

  if (error) {
    return (
      <div className="neo-card p-6 sm:p-8 severity-medium">
        <p className="text-amber-800">{error}</p>
        <p className="mt-3 flex gap-3">
          <button type="button" onClick={onRetry} className="neo-btn px-3 py-1.5 text-sm">
            Retry
          </button>
          <Link href="/projects/new" className="neo-btn-primary px-4 py-2 text-sm inline-block">
            {newItemLabels.menu}
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 sm:space-y-8">
      {stats && <HomeStats data={stats} />}

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
          {user && (
            <p className="mt-0.5 text-xs text-gray-500">
              Viewing as {roleDisplayName(role)}
            </p>
          )}
        </div>
        <Link
          href="/projects/new"
          className="neo-btn-primary inline-block px-5 py-2.5 text-sm font-medium"
        >
          {newItemLabels.menu}
        </Link>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <input
          type="search"
          placeholder="Search by project or client name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="neo-input w-full px-4 py-3 text-sm sm:max-w-sm"
          aria-label="Search projects"
        />
        <div className="neo-segment">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={filter === f ? "neo-btn-pressed px-4 py-2 text-sm font-medium" : "neo-segment-btn"}
            >
              {FILTER_LABEL[f]}
            </button>
          ))}
        </div>
      </div>

      {/* Salesperson queue — quick quotes + invoiced-awaiting-deposit.
          Shown above Ongoing because this is where the salesperson lives. */}
      {(quotes.length > 0 || filter === "quotes") && (
        <section>
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-lg font-medium text-gray-800">Quick quotes & invoices</h2>
            <span className="text-xs text-gray-500">
              {quotes.length} pre-deposit
            </span>
          </div>
          {quotes.length === 0 ? (
            <p className="neo-card p-6 text-sm text-gray-500">
              No open quotes. Start one from &ldquo;{newItemLabels.menu}&rdquo; and pick &ldquo;Quick quote&rdquo;.
            </p>
          ) : (
            <ul className="space-y-3">
              {quotes.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  role={role}
                  onDuplicate={handleDuplicate}
                  onDelete={setDeleteId}
                  duplicatingId={duplicateId}
                />
              ))}
            </ul>
          )}
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-800">Ongoing projects</h2>
        {ongoing.length === 0 ? (
          <p className="neo-card p-6 text-sm text-gray-500">
            No saved projects yet. Create a project and click &ldquo;Save project&rdquo; to move it here.
          </p>
        ) : (
          <ul className="space-y-3">
            {ongoing.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                role={role}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteId}
                duplicatingId={duplicateId}
              />
            ))}
          </ul>
        )}
      </section>

      {drafts.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-gray-800">Legacy drafts</h2>
          <p className="mb-2 text-xs text-gray-500">
            Projects still marked as &ldquo;draft&rdquo; under the old flow. Save or archive to clear.
          </p>
          <ul className="space-y-3">
            {drafts.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                role={role}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteId}
                duplicatingId={duplicateId}
              />
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-800">Done</h2>
        {done.length === 0 ? (
          <p className="neo-card p-6 text-sm text-gray-500">
            No completed projects yet. Mark a project as done from its detail page.
          </p>
        ) : (
          <ul className="space-y-3">
            {done.map((p) => (
              <ProjectCard
                key={p.id}
                project={p}
                role={role}
                onDuplicate={handleDuplicate}
                onDelete={setDeleteId}
                duplicatingId={duplicateId}
                compact
              />
            ))}
          </ul>
        )}
      </section>

      {filter === "archived" && (
        <section>
          <h2 className="mb-3 text-lg font-medium text-gray-800">Archived & lost</h2>
          {archivedOrLost.length === 0 ? (
            <p className="neo-card p-6 text-sm text-gray-500">
              Nothing archived. Quotes auto-archive after two quiet weeks, and salespeople
              can mark a deal as lost from the project page.
            </p>
          ) : (
            <ul className="space-y-3">
              {archivedOrLost.map((p) => (
                <ProjectCard
                  key={p.id}
                  project={p}
                  role={role}
                  onDuplicate={handleDuplicate}
                  onDelete={setDeleteId}
                  duplicatingId={duplicateId}
                  compact
                />
              ))}
            </ul>
          )}
        </section>
      )}

      {deleteId && (
        <ConfirmModal
          title="Delete project"
          message="This cannot be undone. All project data will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

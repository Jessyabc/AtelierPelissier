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
};

const LOAD_TIMEOUT_MS = 8000;
// "quotes" = quick quotes and invoiced-but-no-deposit — the salesperson's
// working queue. Everything confirmed falls through to Ongoing/Drafts/Done.
type FilterKind = "all" | "quotes" | "drafts" | "saved" | "done";

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
  if (filter === "drafts") list = list.filter((p) => p.isDraft);
  else if (filter === "saved") list = list.filter((p) => !p.isDraft && !p.isDone);
  else if (filter === "done") list = list.filter((p) => p.isDone);
  else if (filter === "quotes") list = list.filter((p) => !p.isDone && (p.stage === "quote" || p.stage === "invoiced"));
  return list;
}

/** Pre-deposit work for the salesperson: quotes + issued invoices awaiting deposit. */
function isQuoteStage(p: Project): boolean {
  return !p.isDone && (p.stage === "quote" || p.stage === "invoiced");
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
      setError("Loading took too long. Try Retry or New Project.");
      setLoading(false);
    }, LOAD_TIMEOUT_MS + 2000);
    return () => clearTimeout(t);
  }, [loading]);

  const onRetry = () => {
    setSlowHint(false);
    setRetryKey((k) => k + 1);
  };

  const filtered = filterProjects(projects, search, filter);
  // Quick quotes (and invoiced-but-no-deposit) are shown in their own section
  // and excluded from Ongoing/Drafts so the salesperson queue is isolated
  // from the confirmed production pipeline.
  const quotes = filtered.filter(isQuoteStage);
  const drafts = filtered.filter((p) => p.isDraft && !isQuoteStage(p));
  const ongoing = filtered.filter((p) => !p.isDraft && !p.isDone && !isQuoteStage(p));
  const done = filtered.filter((p) => p.isDone);

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
            New project
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
          New Project
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
          {(["all", "quotes", "drafts", "saved", "done"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={filter === f ? "neo-btn-pressed px-4 py-2 text-sm font-medium" : "neo-segment-btn"}
            >
              {f === "all" ? "All" : f === "quotes" ? "Quotes" : f === "drafts" ? "Drafts" : f === "saved" ? "Saved" : "Done"}
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
              No open quotes. Start one from &ldquo;New Project&rdquo; and pick &ldquo;Quick quote&rdquo;.
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

      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-800">Drafts</h2>
        {drafts.length === 0 ? (
          <p className="neo-card p-6 text-sm text-gray-500">
            No drafts. New projects are saved as drafts until you save them.
          </p>
        ) : (
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
        )}
      </section>

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

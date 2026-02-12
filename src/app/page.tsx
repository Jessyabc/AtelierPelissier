"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ConfirmModal";
import { HomeStats, type StatsData } from "@/components/HomeStats";

type Project = {
  id: string;
  name: string;
  type: string;
  types: string;
  isDraft: boolean;
  updatedAt: string;
  clientFirstName: string | null;
  clientLastName: string | null;
  costLines: Array<{ amount: number }>;
};

const LOAD_TIMEOUT_MS = 8000;
type FilterKind = "all" | "drafts" | "saved" | "estimates";

function getProjectsUrl(): string {
  if (typeof window === "undefined") return "/api/projects";
  return `${window.location.origin}/api/projects`;
}

function fetchWithTimeout(url: string, ms: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);
  return fetch(url, { signal: controller.signal }).finally(() => clearTimeout(timeout));
}

function formatTypes(typesStr?: string | null, fallbackType?: string | null): string {
  if (typesStr && typesStr.trim()) {
    return typesStr
      .split(",")
      .map((t) => t.trim().replace("_", " "))
      .filter(Boolean)
      .join(", ");
  }
  if (fallbackType) return fallbackType.replace("_", " ");
  return "—";
}

function estimateTotal(costLines: Array<{ amount: number }>): number {
  return costLines.reduce((sum, l) => sum + l.amount, 0);
}

function loadProjects(
  setProjects: (p: Project[]) => void,
  setLoading: (v: boolean) => void,
  setError: (e: string | null) => void
) {
  setError(null);
  setLoading(true);
  const url = getProjectsUrl();
  fetchWithTimeout(url, LOAD_TIMEOUT_MS)
    .then((res) => {
      if (!res.ok) {
        return res.json().then((body) => {
          throw new Error(body?.error || `Error ${res.status}`);
        }).catch(() => {
          throw new Error(res.status === 503 ? "Request timed out" : "Could not load projects");
        });
      }
      return res.json();
    })
    .then((data) => {
      setProjects(Array.isArray(data) ? data : []);
      setError(null);
    })
    .catch((err) => {
      setProjects([]);
      setError(
        err?.message === "The user aborted a request." || err?.name === "AbortError"
          ? "Request timed out"
          : err?.message || "Failed to load projects"
      );
    })
    .finally(() => setLoading(false));
}

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
  else if (filter === "saved") list = list.filter((p) => !p.isDraft);
  else if (filter === "estimates") list = list.filter((p) => (p.costLines?.length ?? 0) > 0);
  return list;
}

export default function DashboardPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<Project[]>([]);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterKind>("all");
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);

  useEffect(() => {
    loadProjects(setProjects, setLoading, setError);
  }, []);

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => r.ok ? r.json() : null)
      .then((d) => d && setStats(d))
      .catch(() => {});
  }, []);

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
    loadProjects(setProjects, setLoading, setError);
  };

  const filtered = filterProjects(projects, search, filter);
  const drafts = filtered.filter((p) => p.isDraft);
  const ongoing = filtered.filter((p) => !p.isDraft);
  const withEstimates = filtered.filter((p) => (p.costLines?.length ?? 0) > 0);

  async function handleDelete(projectId: string) {
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Project deleted");
      setDeleteId(null);
      loadProjects(setProjects, setLoading, setError);
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
        <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
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
          {(["all", "drafts", "saved", "estimates"] as const).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={filter === f ? "neo-btn-pressed px-4 py-2 text-sm font-medium" : "neo-segment-btn"}
            >
              {f === "all" ? "All" : f === "drafts" ? "Drafts" : f === "saved" ? "Saved" : "With estimates"}
            </button>
          ))}
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-800">Ongoing projects</h2>
        {ongoing.length === 0 ? (
          <p className="neo-card p-6 text-sm text-gray-500">
            No saved projects yet. Create a project and click “Save project” to move it here.
          </p>
        ) : (
          <ul className="space-y-3">
            {ongoing.map((p) => (
              <li key={p.id} className="neo-card">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="ml-2 text-sm text-gray-500">{formatTypes(p.types, p.type)}</span>
                    <span className="ml-2 text-sm text-gray-500">
                      {[p.clientFirstName, p.clientLastName].filter(Boolean).join(" ") || "—"}
                      {" · "}
                      {new Date(p.updatedAt).toLocaleDateString()}
                    </span>
                    {p.costLines?.length > 0 && (
                      <p className="mt-1 text-sm text-gray-600">
                        Estimate: ${estimateTotal(p.costLines).toLocaleString("en-CA", { minimumFractionDigits: 2 })}
                      </p>
                    )}
                  </Link>
                  <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(p.id)}
                      disabled={duplicateId !== null}
                      className="neo-btn px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {duplicateId === p.id ? "…" : "Duplicate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(p.id)}
                      className="neo-btn px-3 py-1.5 text-xs font-medium text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
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
              <li key={p.id} className="neo-card">
                <div className="flex flex-wrap items-center justify-between gap-2 p-4">
                  <Link href={`/projects/${p.id}`} className="min-w-0 flex-1">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="ml-2 neo-btn-pressed inline-block px-2 py-0.5 text-xs text-gray-600 rounded-lg">Draft</span>
                    <span className="ml-2 text-sm text-gray-500">{formatTypes(p.types, p.type)}</span>
                    <span className="ml-2 text-sm text-gray-500">{new Date(p.updatedAt).toLocaleDateString()}</span>
                  </Link>
                  <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                    <button
                      type="button"
                      onClick={() => handleDuplicate(p.id)}
                      disabled={duplicateId !== null}
                      className="neo-btn px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                    >
                      {duplicateId === p.id ? "…" : "Duplicate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteId(p.id)}
                      className="neo-btn px-3 py-1.5 text-xs font-medium text-red-600"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-3 text-lg font-medium text-gray-800">Estimates</h2>
        {withEstimates.length === 0 ? (
          <p className="neo-card p-6 text-sm text-gray-500">
            No estimates yet. Add cost lines in the Costs tab of a project.
          </p>
        ) : (
          <ul className="space-y-3">
            {withEstimates.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/projects/${p.id}`}
                  className="block neo-card p-4 transition-all hover:shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium text-gray-900">{p.name}</span>
                    <span className="text-sm font-medium text-gray-700">
                      ${estimateTotal(p.costLines).toLocaleString("en-CA", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-500">
                    {formatTypes(p.types, p.type)}
                    {p.clientLastName || p.clientFirstName
                      ? ` · ${[p.clientFirstName, p.clientLastName].filter(Boolean).join(" ")}`
                      : ""}
                  </p>
                </Link>
              </li>
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

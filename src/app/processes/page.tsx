"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ConfirmModal } from "@/components/ConfirmModal";

type ProcessTemplate = {
  id: string;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export default function ProcessesPage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<ProcessTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);

  const loadTemplates = () => {
    setError(null);
    setLoading(true);
    fetch("/api/process-templates")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => {
        setTemplates(Array.isArray(data) ? data : []);
        setError(null);
      })
      .catch((err) => {
        setTemplates([]);
        setError(err?.message || "Failed to load process templates");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadTemplates();
  }, []);

  async function handleCreate() {
    try {
      const res = await fetch("/api/process-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "New process", description: null }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Create failed");
      toast.success("Process created");
      router.push(`/processes/${data.id}`);
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to create process");
    }
  }

  async function handleDuplicate(id: string) {
    setDuplicatingId(id);
    try {
      const res = await fetch("/api/process-templates/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Duplicate failed");
      toast.success("Process duplicated");
      router.push(`/processes/${data.id}`);
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to duplicate process");
      setDuplicatingId(null);
    }
  }

  async function handleDelete(id: string) {
    try {
      const res = await fetch(`/api/process-templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Process deleted");
      setDeleteId(null);
      loadTemplates();
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to delete process");
    }
  }

  if (loading) {
    return (
      <div className="neo-card p-6 sm:p-8">
        <p className="text-gray-600">Loading process templates…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="neo-card p-6 sm:p-8 severity-medium">
        <p className="text-amber-800">{error}</p>
        <button
          type="button"
          onClick={loadTemplates}
          className="mt-3 neo-btn px-4 py-2 text-sm font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Process templates</h1>
        <button
          type="button"
          onClick={handleCreate}
          className="neo-btn-primary inline-block px-5 py-2.5 text-sm font-medium"
        >
          New process
        </button>
      </div>

      <p className="text-sm text-gray-600">
        Define workflow templates as flowcharts. Add steps, connect them, and support branching for
        decision points and parallel paths.
      </p>

      {templates.length === 0 ? (
        <div className="neo-card p-8 text-center">
          <p className="text-gray-600">No process templates yet.</p>
          <p className="mt-2 text-sm text-gray-500">
            Click &quot;New process&quot; to create your first template.
          </p>
          <button
            type="button"
            onClick={handleCreate}
            className="mt-4 neo-btn-primary px-5 py-2.5 text-sm font-medium"
          >
            New process
          </button>
        </div>
      ) : (
        <ul className="space-y-3">
          {templates.map((t) => (
            <li key={t.id} className="neo-card">
              <div className="flex flex-wrap items-center justify-between gap-4 p-4">
                <Link href={`/processes/${t.id}`} className="min-w-0 flex-1">
                  <span className="font-medium text-gray-900">{t.name}</span>
                  {t.description && (
                    <p className="mt-1 text-sm text-gray-600 line-clamp-1">{t.description}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Updated {new Date(t.updatedAt).toLocaleDateString()}
                  </p>
                </Link>
                <div className="flex gap-2" onClick={(e) => e.preventDefault()}>
                  <button
                    type="button"
                    onClick={() => handleDuplicate(t.id)}
                    disabled={duplicatingId !== null}
                    className="neo-btn px-3 py-1.5 text-xs font-medium disabled:opacity-50"
                  >
                    {duplicatingId === t.id ? "…" : "Duplicate"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteId(t.id)}
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

      {deleteId && (
        <ConfirmModal
          title="Delete process"
          message="This cannot be undone. The process template and all its steps will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={() => handleDelete(deleteId)}
          onCancel={() => setDeleteId(null)}
        />
      )}
    </div>
  );
}

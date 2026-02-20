"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ProjectTabs } from "@/components/ProjectTabs";
import { VanityTab } from "@/components/VanityTab";
import { SideUnitTab } from "@/components/SideUnitTab";
import { KitchenTab } from "@/components/KitchenTab";
import { CutListTab } from "@/components/CutListTab";
import { CostsTab } from "@/components/CostsTab";
import { ClientTab } from "@/components/ClientTab";
import { SettingsTab } from "@/components/SettingsTab";
import { QuoteTab } from "@/components/QuoteTab";
import { AuditTab } from "@/components/AuditTab";
import { ServiceCallsTab } from "@/components/ServiceCallsTab";
import { ConfirmModal } from "@/components/ConfirmModal";

type Project = {
  id: string;
  name: string;
  type: string;
  types: string;
  isDraft: boolean;
  isDone: boolean;
  parentProject?: { id: string; name: string; jobNumber: string | null } | null;
  subProjects?: Array<{
    id: string;
    name: string;
    isDone: boolean;
    isDraft: boolean;
    updatedAt: string;
    processTemplateId: string | null;
    processTemplate?: { id: string; name: string } | null;
    taskItems: Array<{ id: string; label: string; isDone: boolean; sortOrder: number }>;
  }>;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  vanityInputs: Record<string, unknown> | null;
  sideUnitInputs: Record<string, unknown> | null;
  projectSettings: { markup: number; taxEnabled: boolean; taxRate: number; sheetFormatId: string | null; sheetFormat?: { id: string; label: string } | null } | null;
  panelParts: Array<{ id: string; label: string; lengthIn: number; widthIn: number; qty: number; materialCode: string | null; thicknessIn: number | null }>;
  costLines: Array<{ id: string; kind: string; category: string; amount: number }>;
};

const TABS = ["Vanity", "Side Unit", "Kitchen", "CutList Import", "Costs", "Quote", "Service Calls", "Client", "Settings", "History"] as const;

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<(typeof TABS)[number]>("Vanity");
  const [savingProject, setSavingProject] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [togglingDone, setTogglingDone] = useState(false);
  const [addingSubProject, setAddingSubProject] = useState(false);
  const [newSubName, setNewSubName] = useState("");
  const [newSubItems, setNewSubItems] = useState<string>("");
  const [newSubProcessId, setNewSubProcessId] = useState<string>("");
  const [processTemplates, setProcessTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [addingItemFor, setAddingItemFor] = useState<string | null>(null);
  const [newItemLabel, setNewItemLabel] = useState("");

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.status === 404) {
        router.push("/");
        return;
      }
      const data = await res.json();
      setProject(data);
    } catch {
      setProject(null);
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchProject();
  }, [fetchProject]);

  useEffect(() => {
    fetch("/api/process-templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProcessTemplates(Array.isArray(data) ? data : []))
      .catch(() => setProcessTemplates([]));
  }, []);

  async function handleSaveProject() {
    if (!project) return;
    const { clientFirstName, clientLastName, clientEmail, clientPhone, clientAddress } = project;
    const missing: string[] = [];
    if (!(clientFirstName ?? "").trim()) missing.push("First name");
    if (!(clientLastName ?? "").trim()) missing.push("Last name");
    if (!(clientEmail ?? "").trim()) missing.push("Email");
    if (!(clientPhone ?? "").trim()) missing.push("Phone");
    if (!(clientAddress ?? "").trim()) missing.push("Address");
    if (missing.length > 0) {
      setSaveError(`Complete client info first: ${missing.join(", ")}. Use the Client tab.`);
      setActiveTab("Client");
      return;
    }
    setSaveError("");
    setSavingProject(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDraft: false }),
      });
      if (!res.ok) throw new Error("Failed to save project");
      await fetchProject();
      toast.success("Project saved");
    } catch {
      setSaveError("Failed to save project.");
      toast.error("Failed to save project");
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDelete() {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed");
      toast.success("Project deleted");
      router.push("/");
    } catch {
      toast.error("Failed to delete project");
    } finally {
      setDeleteConfirm(false);
    }
  }

  async function handleToggleDone() {
    if (!project) return;
    setTogglingDone(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: !project.isDone }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await fetchProject();
      toast.success(project.isDone ? "Marked as not done" : "Marked as done");
    } catch {
      toast.error("Failed to update");
    } finally {
      setTogglingDone(false);
    }
  }

  async function handleAddSubProject() {
    if (!newSubName.trim()) return;
    setAddingSubProject(true);
    try {
      const items = newSubItems
        .split("\n")
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await fetch(`/api/projects/${id}/sub-projects`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newSubName.trim(),
          items,
          processTemplateId: newSubProcessId.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      toast.success("Task added");
      setNewSubName("");
      setNewSubItems("");
      setNewSubProcessId("");
      await fetchProject();
    } catch {
      toast.error("Failed to add task");
    } finally {
      setAddingSubProject(false);
    }
  }

  async function handleAddItem(subProjectId: string) {
    if (!newItemLabel.trim() || addingItemFor !== subProjectId) return;
    try {
      const res = await fetch(`/api/projects/${subProjectId}/task-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newItemLabel.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewItemLabel("");
      setAddingItemFor(null);
      await fetchProject();
    } catch {
      toast.error("Failed to add item");
    }
  }

  async function handleToggleItem(subProjectId: string, itemId: string, isDone: boolean) {
    try {
      const res = await fetch(`/api/projects/${subProjectId}/task-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDone: !isDone }),
      });
      if (!res.ok) throw new Error("Failed");
      await fetchProject();
    } catch {
      toast.error("Failed to update");
    }
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch("/api/projects/duplicate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceId: id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Duplicate failed");
      toast.success("Project duplicated");
      router.push(`/projects/${data.id}`);
    } catch {
      toast.error("Failed to duplicate project");
      setDuplicating(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-gray-600">Loading project…</p>
      </div>
    );
  }
  if (!project) {
    return (
      <div className="py-12">
        <p className="text-red-600">Project not found.</p>
        <Link href="/" className="mt-2 inline-block text-gray-600 underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
          <Link href="/" className="hover:underline">Dashboard</Link>
          {project.parentProject && (
            <>
              <span>/</span>
              <Link href={`/projects/${project.parentProject.id}`} className="hover:underline">
                {project.parentProject.name}
              </Link>
            </>
          )}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 sm:gap-4">
        <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
        {project.parentProject && (
          <span className="text-xs text-gray-500 rounded-lg bg-gray-100 px-2 py-0.5">Sub-project</span>
        )}
        {project.isDraft && (
          <span className="neo-btn-pressed inline-block rounded-lg px-2 py-0.5 text-sm text-amber-800">Draft</span>
        )}
        {project.isDraft && (
          <button
            type="button"
            onClick={handleSaveProject}
            disabled={savingProject}
            className="neo-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {savingProject ? "Saving…" : "Save project"}
          </button>
        )}
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={project.isDone}
            onChange={handleToggleDone}
            disabled={togglingDone}
            className="rounded border-gray-300"
          />
          <span className="text-sm font-medium text-gray-700">Done</span>
        </label>
        {!project.parentProject && (
          <button
            type="button"
            onClick={handleAddSubProject}
            disabled={addingSubProject}
            className="neo-btn px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {addingSubProject ? "…" : "Add task"}
          </button>
        )}
        <button
          type="button"
          onClick={() => handleDuplicate()}
          disabled={duplicating}
          className="neo-btn px-3 py-1.5 text-sm font-medium disabled:opacity-50"
        >
          {duplicating ? "…" : "Duplicate"}
        </button>
        <button
          type="button"
          onClick={() => setDeleteConfirm(true)}
          className="neo-btn px-3 py-1.5 text-sm font-medium text-red-600"
        >
          Delete
        </button>
        </div>
      </div>

      {!project.parentProject && (
        <div className="neo-card mb-4 p-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tasks</h3>
          <p className="text-xs text-gray-500 mb-3">
            Tasks are work items within this project (e.g. B/O return, follow-up). Each task has a checklist of items to be done.
          </p>

          {addingSubProject ? (
            <div className="space-y-3 p-4 rounded-lg bg-gray-50/80 mb-4">
              <input
                type="text"
                value={newSubName}
                onChange={(e) => setNewSubName(e.target.value)}
                placeholder="Task name (e.g. B/O return)"
                className="neo-input w-full px-3 py-2 text-sm"
              />
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Process (optional)</label>
                <select
                  value={newSubProcessId}
                  onChange={(e) => setNewSubProcessId(e.target.value)}
                  className="neo-input w-full px-3 py-2 text-sm"
                >
                  <option value="">— None —</option>
                  {processTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">Link to a process template. Checklist items will be seeded from its steps.</p>
              </div>
              <textarea
                value={newSubItems}
                onChange={(e) => setNewSubItems(e.target.value)}
                placeholder="Items (one per line)
e.g. Receive handles
Install on site
Client sign-off"
                rows={3}
                className="neo-input w-full px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddSubProject}
                  disabled={!newSubName.trim() || addingSubProject}
                  className="neo-btn-primary px-3 py-1.5 text-sm"
                >
                  Add task
                </button>
                <button
                  type="button"
                  onClick={() => { setAddingSubProject(false); setNewSubName(""); setNewSubItems(""); setNewSubProcessId(""); }}
                  className="neo-btn px-3 py-1.5 text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {project.subProjects && project.subProjects.length > 0 ? (
            <div className="space-y-4">
              {project.subProjects.map((sp) => (
                <div key={sp.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                    <span className="font-medium text-gray-900">{sp.name}</span>
                    <div className="flex items-center gap-2">
                      {sp.processTemplate && (
                        <Link
                          href={`/processes/${sp.processTemplate.id}`}
                          className="text-xs text-[var(--accent-hover)] hover:underline"
                        >
                          {sp.processTemplate.name}
                        </Link>
                      )}
                      <Link
                        href={`/projects/${sp.id}`}
                        className="text-xs text-[var(--accent-hover)] hover:underline"
                      >
                        Open full project
                      </Link>
                    </div>
                  </div>
                  <ul className="space-y-1.5">
                    {(sp.taskItems ?? []).map((item) => (
                      <li key={item.id} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.isDone}
                          onChange={() => handleToggleItem(sp.id, item.id, item.isDone)}
                          className="rounded border-gray-300"
                        />
                        <span className={item.isDone ? "text-gray-500 line-through text-sm" : "text-sm text-gray-800"}>
                          {item.label}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {addingItemFor === sp.id ? (
                    <div className="flex gap-2 mt-2">
                      <input
                        type="text"
                        value={newItemLabel}
                        onChange={(e) => setNewItemLabel(e.target.value)}
                        placeholder="New item"
                        className="neo-input flex-1 px-2 py-1.5 text-sm"
                        onKeyDown={(e) => e.key === "Enter" && handleAddItem(sp.id)}
                      />
                      <button
                        type="button"
                        onClick={() => handleAddItem(sp.id)}
                        disabled={!newItemLabel.trim()}
                        className="neo-btn px-2 py-1.5 text-xs"
                      >
                        Add
                      </button>
                      <button
                        type="button"
                        onClick={() => { setAddingItemFor(null); setNewItemLabel(""); }}
                        className="neo-btn px-2 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingItemFor(sp.id)}
                      className="mt-2 text-xs text-gray-500 hover:text-gray-700"
                    >
                      + Add item
                    </button>
                  )}
                </div>
              ))}
            </div>
          ) : !addingSubProject ? (
            <button
              type="button"
              onClick={() => setAddingSubProject(true)}
              className="text-sm text-[var(--accent-hover)] hover:underline"
            >
              + Add first task
            </button>
          ) : null}
        </div>
      )}

      {saveError && (
        <p className="neo-panel-inset mb-4 p-4 text-sm text-amber-800">{saveError}</p>
      )}
      <ProjectTabs
        tabs={TABS}
        activeTab={activeTab}
        onSelect={(tab) => setActiveTab(tab as (typeof TABS)[number])}
      />
      <div className="neo-card mt-4 p-6 sm:p-8">
        {activeTab === "Vanity" && <VanityTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "Side Unit" && <SideUnitTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "Kitchen" && <KitchenTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "CutList Import" && <CutListTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "Costs" && <CostsTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "Quote" && <QuoteTab project={project} />}
        {activeTab === "Service Calls" && (
          <ServiceCallsTab projectId={id} project={project} onUpdate={fetchProject} />
        )}
        {activeTab === "Client" && <ClientTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "Settings" && <SettingsTab projectId={id} project={project} onUpdate={fetchProject} />}
        {activeTab === "History" && <AuditTab projectId={id} />}
      </div>

      {deleteConfirm && (
        <ConfirmModal
          title="Delete project"
          message="This cannot be undone. All project data will be permanently removed."
          confirmLabel="Delete"
          danger
          onConfirm={handleDelete}
          onCancel={() => setDeleteConfirm(false)}
        />
      )}
    </div>
  );
}

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
import { ProjectBoardCard } from "@/components/ProjectBoardCard";

type Project = {
  id: string;
  name: string;
  type: string;
  types: string;
  isDraft: boolean;
  isDone: boolean;
  parentProject?: { id: string; name: string; jobNumber: string | null } | null;
  processTemplate?: { id: string; name: string } | null;
  taskItems?: Array<{ id: string; label: string; isDone: boolean; sortOrder: number }>;
  projectItems?: Array<{
    id: string;
    type: string;
    label: string;
    processTemplateId: string | null;
    processTemplate?: { id: string; name: string } | null;
    taskItems: Array<{ id: string; label: string; isDone: boolean; sortOrder: number }>;
  }>;
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
  jobNumber?: string | null;
  notes?: string | null;
  clientId?: string | null;
  client?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; phone2: string | null; address: string | null } | null;
  client2Id?: string | null;
  client2?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; phone2: string | null; address: string | null } | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientPhone2?: string | null;
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
  const [assigningProcess, setAssigningProcess] = useState(false);
  const [assignProcessId, setAssignProcessId] = useState("");
  const [addingWorkflowItem, setAddingWorkflowItem] = useState(false);
  const [newWorkflowItemLabel, setNewWorkflowItemLabel] = useState("");
  const [addingProjectItem, setAddingProjectItem] = useState(false);
  const [newProjectItemLabel, setNewProjectItemLabel] = useState("");
  const [newProjectItemType, setNewProjectItemType] = useState("vanity");
  const [newProjectItemProcessId, setNewProjectItemProcessId] = useState("");
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedSubProjectId, setExpandedSubProjectId] = useState<string | null>(null);
  const [addingTaskForItemId, setAddingTaskForItemId] = useState<string | null>(null);
  const [newItemTaskLabel, setNewItemTaskLabel] = useState("");

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

  async function handleAssignProcess() {
    if (!assignProcessId.trim()) return;
    setAssigningProcess(true);
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ processTemplateId: assignProcessId.trim() }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed");
      }
      toast.success("Process assigned");
      setAssignProcessId("");
      await fetchProject();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to assign process");
    } finally {
      setAssigningProcess(false);
    }
  }

  async function handleToggleWorkflowItem(itemId: string, isDone: boolean) {
    try {
      const res = await fetch(`/api/projects/${id}/task-items/${itemId}`, {
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

  async function handleAddWorkflowItem() {
    if (!newWorkflowItemLabel.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/task-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newWorkflowItemLabel.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewWorkflowItemLabel("");
      setAddingWorkflowItem(false);
      await fetchProject();
    } catch {
      toast.error("Failed to add item");
    }
  }

  async function handleAddProjectItem() {
    if (!newProjectItemLabel.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/project-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newProjectItemType,
          label: newProjectItemLabel.trim(),
          processTemplateId: newProjectItemProcessId.trim() || undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed");
      }
      toast.success("Item added");
      setNewProjectItemLabel("");
      setNewProjectItemType("vanity");
      setNewProjectItemProcessId("");
      setAddingProjectItem(false);
      await fetchProject();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add item");
    }
  }

  async function handleDeleteProjectItem(itemId: string) {
    try {
      const res = await fetch(`/api/projects/${id}/project-items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success("Item removed");
      setExpandedItemId(null);
      await fetchProject();
    } catch {
      toast.error("Failed to remove item");
    }
  }

  async function handleToggleProjectItemTask(itemId: string, taskId: string, isDone: boolean) {
    try {
      const res = await fetch(`/api/projects/${id}/project-items/${itemId}/task-items/${taskId}`, {
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

  async function handleAddProjectItemTask(itemId: string) {
    if (!newItemTaskLabel.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/project-items/${itemId}/task-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: newItemTaskLabel.trim() }),
      });
      if (!res.ok) throw new Error("Failed");
      setNewItemTaskLabel("");
      setAddingTaskForItemId(null);
      await fetchProject();
    } catch {
      toast.error("Failed to add step");
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
          <h3 className="text-sm font-medium text-gray-700 mb-1">Project Board</h3>
          <p className="text-xs text-gray-500 mb-4">
            Track project phases, deliverables, and follow-up tasks in one place. Expand any card to see or edit its checklist.
          </p>

          {!project.processTemplate && (!project.taskItems || project.taskItems.length === 0) && (
            <div className="space-y-3 p-4 rounded-lg bg-gray-50/80 mb-4">
              <label className="block text-xs font-medium text-gray-600">Assign process template</label>
              <div className="flex flex-wrap gap-2">
                <select
                  value={assignProcessId}
                  onChange={(e) => setAssignProcessId(e.target.value)}
                  className="neo-input px-3 py-2 text-sm min-w-[160px]"
                >
                  <option value="">— Select process —</option>
                  {processTemplates.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleAssignProcess}
                  disabled={!assignProcessId.trim() || assigningProcess}
                  className="neo-btn-primary px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {assigningProcess ? "Assigning…" : "Assign process"}
                </button>
              </div>
              <p className="text-xs text-gray-500">Checklist items will be seeded from the template steps.</p>
            </div>
          )}

          <div className="space-y-3">
            {(project.processTemplate || (project.taskItems && project.taskItems.length > 0)) && (
              <ProjectBoardCard
                id="project-workflow"
                label="Project workflow"
                badge="Project"
                badgeVariant="gray"
                processTemplate={project.processTemplate}
                doneCount={(project.taskItems ?? []).filter((t) => t.isDone).length}
                totalCount={project.taskItems?.length ?? 0}
                currentStep={
                  project.taskItems?.length
                    ? project.taskItems.find((t) => !t.isDone)?.label ??
                      (project.taskItems[project.taskItems.length - 1]?.label + " ✓")
                    : "—"
                }
                isExpanded={expandedItemId === "project-workflow"}
                onToggleExpand={() => setExpandedItemId(expandedItemId === "project-workflow" ? null : "project-workflow")}
                taskItems={project.taskItems ?? []}
                onToggleTask={(itemId) => handleToggleWorkflowItem(itemId, (project.taskItems ?? []).find((t) => t.id === itemId)?.isDone ?? false)}
                addingStep={addingWorkflowItem}
                newStepLabel={newWorkflowItemLabel}
                onNewStepChange={setNewWorkflowItemLabel}
                onAddStep={handleAddWorkflowItem}
                onCancelAddStep={() => { setAddingWorkflowItem(false); setNewWorkflowItemLabel(""); }}
                onStartAddStep={() => setAddingWorkflowItem(true)}
                onDelete={undefined}
              />
            )}

            {addingProjectItem ? (
              <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50/50">
                <input
                  type="text"
                  value={newProjectItemLabel}
                  onChange={(e) => setNewProjectItemLabel(e.target.value)}
                  placeholder="Label (e.g. Main bath vanity)"
                  className="neo-input w-full px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap gap-3">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-gray-600">Type</label>
                    <select
                      value={newProjectItemType}
                      onChange={(e) => setNewProjectItemType(e.target.value)}
                      className="neo-input px-3 py-2 text-sm"
                    >
                      <option value="vanity">Vanity</option>
                      <option value="side_unit">Side unit</option>
                      <option value="kitchen">Kitchen</option>
                      <option value="panel">Panel</option>
                      <option value="custom">Custom</option>
                    </select>
                  </div>
                  <div className="min-w-[160px]">
                    <label className="mb-1 block text-xs font-medium text-gray-600">Process (optional)</label>
                    <select
                      value={newProjectItemProcessId}
                      onChange={(e) => setNewProjectItemProcessId(e.target.value)}
                      className="neo-input w-full px-3 py-2 text-sm"
                    >
                      <option value="">— None —</option>
                      {processTemplates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleAddProjectItem}
                    disabled={!newProjectItemLabel.trim()}
                    className="neo-btn-primary px-4 py-2 text-sm"
                  >
                    Add deliverable
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddingProjectItem(false); setNewProjectItemLabel(""); setNewProjectItemProcessId(""); }}
                    className="neo-btn px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : null}

            {(project.projectItems ?? []).map((item) => {
              const isExpanded = expandedItemId === item.id;
              const doneCount = item.taskItems.filter((t) => t.isDone).length;
              const totalCount = item.taskItems.length;
              const currentStep =
                totalCount > 0
                  ? item.taskItems.find((t) => !t.isDone)?.label ??
                    (item.taskItems[item.taskItems.length - 1]?.label + " ✓")
                  : "—";
              return (
                <ProjectBoardCard
                  key={item.id}
                  id={item.id}
                  label={item.label}
                  badge={item.type.replace("_", " ")}
                  badgeVariant="accent"
                  processTemplate={item.processTemplate}
                  doneCount={doneCount}
                  totalCount={totalCount}
                  currentStep={currentStep}
                  isExpanded={isExpanded}
                  onToggleExpand={() => setExpandedItemId(isExpanded ? null : item.id)}
                  taskItems={item.taskItems}
                  onToggleTask={(taskId) => handleToggleProjectItemTask(item.id, taskId, item.taskItems.find((t) => t.id === taskId)?.isDone ?? false)}
                  addingStep={addingTaskForItemId === item.id}
                  newStepLabel={newItemTaskLabel}
                  onNewStepChange={setNewItemTaskLabel}
                  onAddStep={() => handleAddProjectItemTask(item.id)}
                  onCancelAddStep={() => { setAddingTaskForItemId(null); setNewItemTaskLabel(""); }}
                  onStartAddStep={() => setAddingTaskForItemId(item.id)}
                  onDelete={() => handleDeleteProjectItem(item.id)}
                />
              );
            })}

            {addingSubProject ? (
              <div className="space-y-3 p-4 rounded-lg border border-gray-200 bg-gray-50/50">
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
                  <p className="mt-1 text-xs text-gray-500">Checklist items will be seeded from the template.</p>
                </div>
                <textarea
                  value={newSubItems}
                  onChange={(e) => setNewSubItems(e.target.value)}
                  placeholder="Items (one per line) e.g. Receive handles, Install on site, Client sign-off"
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
                    Add follow-up task
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

            {project.subProjects?.map((sp) => {
              const isSubExpanded = expandedSubProjectId === sp.id;
              const doneCount = (sp.taskItems ?? []).filter((t) => t.isDone).length;
              const totalCount = sp.taskItems?.length ?? 0;
              const currentStep = sp.taskItems?.find((t) => !t.isDone)?.label ??
                (totalCount > 0 ? (sp.taskItems?.[totalCount - 1]?.label + " ✓") : "—");
              return (
              <div key={sp.id} className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-white">
                  <button
                    type="button"
                    onClick={() => setExpandedSubProjectId(isSubExpanded ? null : sp.id)}
                    className="flex-1 min-w-0 text-left hover:bg-gray-50/50 -m-3 p-3 rounded-lg"
                  >
                    <span className="inline-block rounded-md bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 mb-1">Follow-up</span>
                    <p className="font-medium text-gray-900">{sp.name}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {totalCount > 0 ? `${doneCount}/${totalCount} · ` : ""}
                      Current: {currentStep}
                    </p>
                  </button>
                  <span className="text-gray-400 shrink-0">{isSubExpanded ? "▼" : "▶"}</span>
                  <Link href={`/projects/${sp.id}`} className="neo-btn px-3 py-1.5 text-xs shrink-0" onClick={(e) => e.stopPropagation()}>
                    Open
                  </Link>
                </div>
                {isSubExpanded && (
                <div className="border-t border-gray-200 p-3 bg-gray-50/30">
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
                )}
              </div>
            );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 pt-3 border-t border-gray-200">
            {!addingProjectItem && (
              <button
                type="button"
                onClick={() => setAddingProjectItem(true)}
                className="text-sm text-[var(--accent-hover)] hover:underline"
              >
                + Add deliverable
              </button>
            )}
            {!addingSubProject && (
              <button
                type="button"
                onClick={() => setAddingSubProject(true)}
                className="text-sm text-gray-600 hover:text-gray-800"
              >
                + Add follow-up task
              </button>
            )}
          </div>
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

"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { NextActionButton } from "@/components/NextActionButton";
import toast from "react-hot-toast";
import { VanityTab } from "@/components/VanityTab";
import { SideUnitTab } from "@/components/SideUnitTab";
import { KitchenTab } from "@/components/KitchenTab";
import { PrerequisitesTab } from "@/components/PrerequisitesTab";
import { CostsTab } from "@/components/CostsTab";
import { ClientTab } from "@/components/ClientTab";
import { SettingsTab } from "@/components/SettingsTab";
import { QuoteTab } from "@/components/QuoteTab";
import { AuditTab } from "@/components/AuditTab";
import { ServiceCallsTab } from "@/components/ServiceCallsTab";
import { ConfirmModal } from "@/components/ConfirmModal";
import { ProjectBoardCard } from "@/components/ProjectBoardCard";
import { ReadinessChecklistCard } from "@/components/ReadinessChecklistCard";
import { BlockedReasonBadge } from "@/components/BlockedReasonBadge";
import { computeReadinessCheck } from "@/lib/readiness";
import { DraftIntakePanel } from "@/components/DraftIntakePanel";
import { ProductionTab } from "@/components/ProductionTab";

type TaskItem = { id: string; label: string; isDone: boolean; sortOrder: number };
type ProjItem = {
  id: string; type: string; label: string;
  processTemplateId: string | null;
  processTemplate?: { id: string; name: string } | null;
  taskItems: TaskItem[];
  cutlists?: { id: string; name: string; sortOrder: number }[];
};
type SubProject = {
  id: string; name: string; isDone: boolean; isDraft: boolean; updatedAt: string;
  processTemplateId: string | null;
  processTemplate?: { id: string; name: string } | null;
  taskItems: TaskItem[];
};

type Project = {
  id: string; name: string; type: string; types: string;
  isDraft: boolean; isDone: boolean;
  parentProject?: { id: string; name: string; jobNumber: string | null } | null;
  processTemplate?: { id: string; name: string } | null;
  taskItems?: TaskItem[];
  projectItems?: ProjItem[];
  subProjects?: SubProject[];
  jobNumber?: string | null; notes?: string | null;
  clientId?: string | null;
  client?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; phone2: string | null; address: string | null } | null;
  client2Id?: string | null;
  client2?: { id: string; firstName: string; lastName: string; email: string | null; phone: string | null; phone2: string | null; address: string | null } | null;
  clientFirstName: string | null; clientLastName: string | null; clientEmail: string | null; clientPhone: string | null; clientPhone2?: string | null; clientAddress: string | null;
  vanityInputs: Record<string, unknown> | null;
  sideUnitInputs: Record<string, unknown> | null;
  projectSettings: { markup: number; taxEnabled: boolean; taxRate: number; sheetFormatId: string | null; sheetFormat?: { id: string; label: string } | null; [key: string]: unknown } | null;
  panelParts: Array<{ id: string; label: string; lengthIn: number; widthIn: number; qty: number; materialCode: string | null; thicknessIn: number | null; cutlistId?: string | null }>;
  prerequisiteLines?: Array<{ id: string; materialCode: string; category: string; quantity: number; needed: boolean }>;
  costLines: Array<{ id: string; kind: string; category: string; amount: number }>;
  materialRequirements?: Array<{ materialCode: string; requiredQty: number; allocatedQty: number }>;
  sellingPrice?: number | null;
  targetDate?: string | null;
  blockedReason?: string | null;
};

type Tab = "Overview" | "Client & Info" | "Estimates & Costs" | "Production" | "Service Calls" | "History";

const VALID_TABS: readonly Tab[] = ["Overview", "Client & Info", "Estimates & Costs", "Production", "Service Calls", "History"] as const;

function parseTabParam(v: string | null): Tab | null {
  if (!v) return null;
  return (VALID_TABS as readonly string[]).includes(v) ? (v as Tab) : null;
}

export default function ProjectPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const initialTab = parseTabParam(searchParams?.get("tab") ?? null) ?? "Overview";
  const [activeTab, setActiveTab] = useState<Tab>(initialTab);

  // Sync activeTab with ?tab= param — lets NextActionButton/links deep-link to a tab.
  useEffect(() => {
    const t = parseTabParam(searchParams?.get("tab") ?? null);
    if (t && t !== activeTab) setActiveTab(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);
  const [savingProject, setSavingProject] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [duplicating, setDuplicating] = useState(false);
  const [togglingDone, setTogglingDone] = useState(false);
  const [processTemplates, setProcessTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [companyConfig, setCompanyConfig] = useState<{ companyName?: string; companyPhone?: string; companyEmail?: string; companyAddress?: string }>({});

  // Board state
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [addingProjectItem, setAddingProjectItem] = useState(false);
  const [newProjectItemLabel, setNewProjectItemLabel] = useState("");
  const [newProjectItemType, setNewProjectItemType] = useState("custom");
  const [newProjectItemProcessId, setNewProjectItemProcessId] = useState("");
  const [addingTaskForItemId, setAddingTaskForItemId] = useState<string | null>(null);
  const [newItemTaskLabel, setNewItemTaskLabel] = useState("");
  const [addingWorkflowItem, setAddingWorkflowItem] = useState(false);
  const [newWorkflowItemLabel, setNewWorkflowItemLabel] = useState("");

  // Selling price edit
  const [editingPrice, setEditingPrice] = useState(false);
  const [priceInput, setPriceInput] = useState("");

  // Recalculation health
  const [recalcError, setRecalcError] = useState<{ message: string; failedAt: string } | null>(null);
  const [retryingRecalc, setRetryingRecalc] = useState(false);

  // Material snapshot state (used by NextActionButton to suggest "Verify materials" / "Regenerate materials")
  const [hasMaterialSnapshot, setHasMaterialSnapshot] = useState(false);
  const [hasStaleMaterialSnapshot, setHasStaleMaterialSnapshot] = useState(false);

  const checkRecalcStatus = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}/recalc-status`);
      if (!res.ok) return;
      const data = await res.json();
      setRecalcError(data.ok ? null : { message: data.error, failedAt: data.failedAt });
    } catch { /* non-critical */ }
  }, [id]);

  const retryRecalc = async () => {
    setRetryingRecalc(true);
    try {
      const res = await fetch(`/api/projects/${id}/recalc-status`, { method: "POST" });
      const data = await res.json();
      if (data.ok) {
        setRecalcError(null);
        toast.success("Recalculation succeeded");
        await fetchProject();
      } else {
        toast.error("Recalculation failed again — check System Health");
      }
    } catch {
      toast.error("Could not reach server");
    } finally {
      setRetryingRecalc(false);
    }
  };

  const fetchProject = useCallback(async () => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.status === 404) { router.push("/"); return; }
      setProject(await res.json());
    } catch { setProject(null); } finally { setLoading(false); }
  }, [id, router]);

  useEffect(() => { fetchProject(); checkRecalcStatus(); }, [fetchProject, checkRecalcStatus]);

  // Fetch material snapshot status for both vanity & side_unit in parallel
  useEffect(() => {
    let alive = true;
    Promise.all([
      fetch(`/api/projects/${id}/material-snapshot?sourceType=vanity`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`/api/projects/${id}/material-snapshot?sourceType=side_unit`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([v, s]) => {
      if (!alive) return;
      const snaps = [v?.snapshot, s?.snapshot].filter(Boolean);
      setHasMaterialSnapshot(snaps.length > 0);
      setHasStaleMaterialSnapshot(snaps.some((x: { isStale?: boolean }) => x?.isStale));
    });
    return () => { alive = false; };
  }, [id]);
  useEffect(() => {
    fetch("/api/process-templates").then((r) => r.ok ? r.json() : []).then((d) => setProcessTemplates(Array.isArray(d) ? d : [])).catch(() => {});
    fetch("/api/admin/config").then((r) => r.ok ? r.json() : null).then((cfg) => {
      if (cfg) setCompanyConfig({ companyName: cfg.companyName, companyPhone: cfg.companyPhone, companyEmail: cfg.companyEmail, companyAddress: cfg.companyAddress });
    }).catch(() => {});
  }, []);

  // --- Handlers ---
  async function handleSaveProject() {
    if (!project) return;
    setSaveError(""); setSavingProject(true);
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDraft: false }) });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        missing?: string[];
        readinessWarning?: { missing?: string[] };
      };
      if (!res.ok) {
        if (data.error === "readiness_check_failed" && Array.isArray(data.missing)) {
          setSaveError(`Complete required fields: ${data.missing.join(", ")}`);
          toast.error("Readiness check failed");
          return;
        }
        throw new Error("Failed");
      }
      await fetchProject();
      toast.success("Project saved");
      if (data.readinessWarning?.missing?.length) {
        toast(`Still incomplete for strict gate: ${data.readinessWarning.missing.join(", ")}`, { duration: 5000 });
      }
    } catch {
      setSaveError("Failed to save.");
      toast.error("Failed");
    } finally {
      setSavingProject(false);
    }
  }

  async function handleDelete() {
    try {
      await fetch(`/api/projects/${id}`, { method: "DELETE" });
      toast.success("Deleted"); router.push("/");
    } catch { toast.error("Failed"); } finally { setDeleteConfirm(false); }
  }

  async function handleToggleDone() {
    if (!project) return; setTogglingDone(true);
    try {
      await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDone: !project.isDone }) });
      await fetchProject(); toast.success(project.isDone ? "Reopened" : "Marked done");
    } catch { toast.error("Failed"); } finally { setTogglingDone(false); }
  }

  async function handleToggleWorkflowItem(itemId: string, isDone: boolean) {
    await fetch(`/api/projects/${id}/task-items/${itemId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDone: !isDone }) });
    await fetchProject();
  }

  async function handleAddWorkflowItem() {
    if (!newWorkflowItemLabel.trim()) return;
    await fetch(`/api/projects/${id}/task-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newWorkflowItemLabel.trim() }) });
    setNewWorkflowItemLabel(""); setAddingWorkflowItem(false); await fetchProject();
  }

  async function handleAddProjectItem() {
    if (!newProjectItemLabel.trim()) return;
    if (!newProjectItemProcessId?.trim()) {
      toast.error("Select a process for this room");
      return;
    }
    try {
      const res = await fetch(`/api/projects/${id}/project-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: newProjectItemType,
          label: newProjectItemLabel.trim(),
          processTemplateId: newProjectItemProcessId.trim(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error ?? `Could not add room (${res.status})`);
        return;
      }
      toast.success("Room added");
      setNewProjectItemLabel("");
      setNewProjectItemProcessId("");
      setAddingProjectItem(false);
      await fetchProject();
    } catch {
      toast.error("Could not add room — check your connection");
    }
  }

  async function handleDeleteProjectItem(itemId: string) {
    await fetch(`/api/projects/${id}/project-items/${itemId}`, { method: "DELETE" });
    toast.success("Removed"); setExpandedItemId(null); await fetchProject();
  }

  async function handleToggleProjectItemTask(itemId: string, taskId: string, isDone: boolean) {
    await fetch(`/api/projects/${id}/project-items/${itemId}/task-items/${taskId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isDone: !isDone }) });
    await fetchProject();
  }

  async function handleAddProjectItemTask(itemId: string) {
    if (!newItemTaskLabel.trim()) return;
    await fetch(`/api/projects/${id}/project-items/${itemId}/task-items`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newItemTaskLabel.trim() }) });
    setNewItemTaskLabel(""); setAddingTaskForItemId(null); await fetchProject();
  }

  async function handleDuplicate() {
    setDuplicating(true);
    try {
      const res = await fetch("/api/projects/duplicate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sourceId: id }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      toast.success("Duplicated"); router.push(`/projects/${data.id}`);
    } catch { toast.error("Failed"); setDuplicating(false); }
  }

  async function handleSaveSellingPrice() {
    const val = parseFloat(priceInput);
    if (isNaN(val)) return;
    await fetch(`/api/projects/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sellingPrice: val }) });
    setEditingPrice(false); await fetchProject(); toast.success("Price saved");
  }

  const publishReadiness = useMemo(() => {
    if (!project) return { ready: true, missing: [] as string[] };
    return computeReadinessCheck({
      jobNumber: project.jobNumber,
      clientId: project.clientId,
      clientFirstName: project.clientFirstName,
      clientLastName: project.clientLastName,
      targetDate: project.targetDate ? new Date(project.targetDate) : null,
      projectItemCount: project.projectItems?.length ?? 0,
    });
  }, [project]);

  const strictReadinessGate = process.env.NEXT_PUBLIC_READINESS_GATE_STRICT === "true";
  const saveBlockedByReadiness =
    project !== null && strictReadinessGate && project.isDraft && !publishReadiness.ready;
  const saveTitle = saveBlockedByReadiness
    ? `Complete: ${publishReadiness.missing.join(", ")}`
    : project !== null && !publishReadiness.ready
      ? "You can save while the gate is soft; strict mode would require the checklist."
      : undefined;

  if (loading) return <div className="py-12 text-center text-[var(--foreground-muted)]">Loading project...</div>;
  if (!project) return <div className="py-12"><p className="text-red-500">Project not found.</p><Link href="/" className="underline text-[var(--foreground-muted)]">Back</Link></div>;

  // Compute financials
  const estimatedCost = project.costLines.filter((c) => c.kind === "estimate").reduce((s, c) => s + c.amount, 0);
  const realCost = project.costLines.filter((c) => c.kind === "actual").reduce((s, c) => s + c.amount, 0);
  const sellingPrice = project.sellingPrice ?? 0;
  const profit = sellingPrice - realCost;
  const variance = estimatedCost - realCost;

  const types = project.types.split(",").map((t) => t.trim());
  const tabs: Tab[] = ["Overview", "Client & Info", "Estimates & Costs", "Production", "Service Calls", "History"];

  // Total task progress (per-room tasks only)
  const allItems = project.projectItems ?? [];
  const allTasks = allItems.flatMap((i) => i.taskItems);
  const totalDone = allTasks.filter((t) => t.isDone).length;
  const totalTasks = allTasks.length;

  // Material status
  const matReqs = project.materialRequirements ?? [];
  const totalRequired = matReqs.reduce((s, r) => s + r.requiredQty, 0);
  const totalAllocated = matReqs.reduce((s, r) => s + r.allocatedQty, 0);
  const shortages = matReqs.filter((r) => r.allocatedQty < r.requiredQty);

  return (
    <div>
      {/* Recalculation error banner */}
      {recalcError && (
        <div className="mb-4 flex items-center gap-3 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="shrink-0 text-base">⚠️</span>
          <span className="flex-1">
            <strong>Numbers may be stale.</strong> The last recalculation failed: {recalcError.message}
          </span>
          <button
            type="button"
            onClick={retryRecalc}
            disabled={retryingRecalc}
            className="shrink-0 rounded border border-amber-400 bg-white px-3 py-1 text-xs font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50"
          >
            {retryingRecalc ? "Retrying…" : "Retry"}
          </button>
          <button
            type="button"
            onClick={() => setRecalcError(null)}
            className="shrink-0 text-amber-500 hover:text-amber-700"
            aria-label="Dismiss"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="mb-4">
        <div className="flex flex-wrap items-center gap-2 text-sm text-[var(--foreground-muted)]">
          <Link href="/" className="hover:underline">Projects</Link>
          {project.parentProject && (<><span>/</span><Link href={`/projects/${project.parentProject.id}`} className="hover:underline">{project.parentProject.name}</Link></>)}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{project.name}</h2>
          {project.isDraft && <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Draft</span>}
          {project.isDone && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Done</span>}
          {project.blockedReason && (
            <BlockedReasonBadge reason={project.blockedReason} />
          )}
          {/* Role-aware next action — the guided-workflow spine */}
          <NextActionButton
            project={{
              id: project.id,
              isDraft: project.isDraft,
              isDone: project.isDone,
              types: project.types,
              clientId: project.clientId,
              clientFirstName: project.clientFirstName,
              clientLastName: project.clientLastName,
              targetDate: project.targetDate,
              projectItems: project.projectItems,
              costLines: project.costLines,
              sellingPrice: project.sellingPrice,
              blockedReason: project.blockedReason,
              hasMaterialSnapshot,
              hasStaleMaterialSnapshot,
            }}
            onClick={(href) => {
              // If the href targets a tab, switch immediately (URL update still fires via Link)
              const m = href.match(/[?&]tab=([^&]+)/);
              if (m) {
                const t = parseTabParam(decodeURIComponent(m[1]));
                if (t) setActiveTab(t);
              }
            }}
          />
          {project.isDraft && (
            <button
              type="button"
              onClick={handleSaveProject}
              disabled={savingProject || saveBlockedByReadiness}
              title={saveTitle}
              className="neo-btn px-4 py-1.5 text-sm disabled:opacity-50"
            >
              {savingProject ? "Saving..." : "Save Project"}
            </button>
          )}
          <label className="flex items-center gap-1.5 cursor-pointer text-sm text-[var(--foreground)]">
            <input type="checkbox" checked={project.isDone} onChange={handleToggleDone} disabled={togglingDone} className="rounded" />
            Done
          </label>
          <button onClick={() => handleDuplicate()} disabled={duplicating} className="neo-btn px-3 py-1.5 text-xs">Duplicate</button>
          <button onClick={() => setDeleteConfirm(true)} className="neo-btn px-3 py-1.5 text-xs text-red-500">Delete</button>
        </div>
      </div>
      {saveError && <p className="neo-panel-inset mb-4 p-3 text-sm text-amber-800">{saveError}</p>}

      {/* Tab bar */}
      <div className="flex flex-wrap gap-1 mb-4 overflow-x-auto p-2.5 justify-center items-center text-center align-middle">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-1.5 text-xs rounded-lg transition-colors whitespace-nowrap mx-[5px] ${
              activeTab === tab ? "neo-btn-primary font-medium" : "neo-btn"
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* === OVERVIEW TAB === */}
      {activeTab === "Overview" && (
        <div className="space-y-5">
          {project.isDraft && (
            <DraftIntakePanel
              project={project}
              processTemplates={processTemplates}
              onApplied={fetchProject}
            />
          )}
          {project.isDraft && <ReadinessChecklistCard project={project} />}
          {/* Summary strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="neo-card p-3 text-center">
              <div className="text-xs text-[var(--foreground-muted)]">Progress</div>
              <div className="text-lg font-bold text-[var(--foreground)]">{totalTasks > 0 ? Math.round((totalDone / totalTasks) * 100) : 0}%</div>
              <div className="text-[10px] text-[var(--foreground-muted)]">{totalDone}/{totalTasks} tasks</div>
              {totalTasks > 0 && (
                <div className="mt-1 h-1.5 bg-[var(--bg-light)] rounded-full overflow-hidden">
                  <div className="h-full bg-[var(--accent)] rounded-full transition-all" style={{ width: `${(totalDone / totalTasks) * 100}%` }} />
                </div>
              )}
            </div>
            <div className="neo-card p-3 text-center">
              <div className="text-xs text-[var(--foreground-muted)]">Materials</div>
              <div className={`text-lg font-bold ${shortages.length > 0 ? "text-amber-600" : "text-emerald-600"}`}>
                {totalRequired > 0 ? Math.round((totalAllocated / totalRequired) * 100) : 100}%
              </div>
              <div className="text-[10px] text-[var(--foreground-muted)]">
                {shortages.length > 0 ? `${shortages.length} shortage${shortages.length > 1 ? "s" : ""}` : "Covered"}
              </div>
            </div>
            <div className="neo-card p-3 text-center">
              <div className="text-xs text-[var(--foreground-muted)]">Selling Price</div>
              {editingPrice ? (
                <div className="flex items-center gap-1 mt-1">
                  <input type="number" min={0} step={0.01} value={priceInput} onChange={(e) => setPriceInput(e.target.value)} className="neo-input w-20 px-1 py-0.5 text-sm text-center" autoFocus onKeyDown={(e) => e.key === "Enter" && handleSaveSellingPrice()} />
                  <button onClick={handleSaveSellingPrice} className="text-xs text-[var(--accent)]">OK</button>
                </div>
              ) : (
                <button onClick={() => { setPriceInput(String(sellingPrice || "")); setEditingPrice(true); }} className="text-lg font-bold text-[var(--foreground)] hover:text-[var(--accent)]">
                  {sellingPrice > 0 ? `$${sellingPrice.toLocaleString()}` : "Set"}
                </button>
              )}
            </div>
            <div className="neo-card p-3 text-center">
              <div className="text-xs text-[var(--foreground-muted)]">Profit</div>
              <div className={`text-lg font-bold ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                {sellingPrice > 0 ? `$${profit.toLocaleString()}` : "—"}
              </div>
              <div className="text-[10px] text-[var(--foreground-muted)]">
                Est: ${estimatedCost.toLocaleString()} · Real: ${realCost.toLocaleString()} {variance !== 0 && <span className={variance > 0 ? "text-emerald-600" : "text-red-500"}>({variance > 0 ? "+" : ""}{variance.toLocaleString()})</span>}
              </div>
            </div>
          </div>

          {/* Timeline / Process Board */}
          {!project.parentProject && (
            <div className="neo-card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[var(--foreground)]">Timeline & Rooms</h3>
                <div className="flex gap-2">
                  {!addingProjectItem && (
                    <button onClick={() => setAddingProjectItem(true)} className="neo-btn px-3 py-1 text-xs">+ Add Room</button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {/* Room / deliverable cards — process is always per room */}
                {allItems.map((item) => {
                  const isExpanded = expandedItemId === item.id;
                  const done = item.taskItems.filter((t) => t.isDone).length;
                  const total = item.taskItems.length;
                  const cur = total > 0 ? item.taskItems.find((t) => !t.isDone)?.label ?? "All done" : "—";
                  return (
                    <ProjectBoardCard
                      key={item.id}
                      id={item.id}
                      label={item.label}
                      badge={item.type.replace("_", " ")}
                      badgeVariant="accent"
                      processTemplate={item.processTemplate}
                      doneCount={done}
                      totalCount={total}
                      currentStep={cur}
                      isExpanded={isExpanded}
                      onToggleExpand={() => setExpandedItemId(isExpanded ? null : item.id)}
                      taskItems={item.taskItems}
                      onToggleTask={(tid) => handleToggleProjectItemTask(item.id, tid, item.taskItems.find((t) => t.id === tid)?.isDone ?? false)}
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

                {/* Add room form */}
                {addingProjectItem && (
                  <div className="neo-panel-inset p-4 space-y-3">
                    <input value={newProjectItemLabel} onChange={(e) => setNewProjectItemLabel(e.target.value)} placeholder="Room label (e.g. Master Bath Vanity)" className="neo-input w-full px-3 py-2 text-sm" autoFocus />
                    {processTemplates.length === 0 && (
                      <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        No process templates are defined yet. Create at least one{" "}
                        <Link href="/processes" className="font-medium underline underline-offset-2">
                          Process
                        </Link>{" "}
                        first, then add rooms here.
                      </p>
                    )}
                    <div className="flex flex-wrap gap-3">
                      <select value={newProjectItemType} onChange={(e) => setNewProjectItemType(e.target.value)} className="neo-select px-3 py-2 text-sm">
                        <option value="kitchen">Kitchen</option>
                        <option value="vanity">Vanity</option>
                        <option value="closet">Closet</option>
                        <option value="commercial">Commercial</option>
                        <option value="laundry">Laundry</option>
                        <option value="entertainment">Entertainment</option>
                        <option value="custom">Custom</option>
                      </select>
                      <select value={newProjectItemProcessId} onChange={(e) => setNewProjectItemProcessId(e.target.value)} className="neo-select px-3 py-2 text-sm" required aria-required="true">
                        <option value="">Select process (required)</option>
                        {processTemplates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                      </select>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={handleAddProjectItem} disabled={!newProjectItemLabel.trim() || !newProjectItemProcessId?.trim()} className="neo-btn-primary px-4 py-1.5 text-sm disabled:opacity-50">Add Room</button>
                      <button onClick={() => { setAddingProjectItem(false); setNewProjectItemLabel(""); }} className="neo-btn px-3 py-1.5 text-sm">Cancel</button>
                    </div>
                  </div>
                )}

                {/* Sub-projects / follow-ups */}
                {project.subProjects?.map((sp) => (
                  <div key={sp.id} className="neo-card p-3 opacity-80">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 mr-2">Follow-up</span>
                        <span className="text-sm font-medium text-[var(--foreground)]">{sp.name}</span>
                        <span className="text-xs text-[var(--foreground-muted)] ml-2">{(sp.taskItems ?? []).filter((t) => t.isDone).length}/{sp.taskItems?.length ?? 0}</span>
                      </div>
                      <Link href={`/projects/${sp.id}`} className="neo-btn px-2 py-1 text-xs">Open</Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Material shortages */}
          {shortages.length > 0 && (
            <div className="neo-card p-4 severity-medium">
              <h4 className="text-sm font-semibold text-amber-800 mb-2">Material Shortages</h4>
              <div className="space-y-1">
                {shortages.map((r) => (
                  <div key={r.materialCode} className="flex justify-between text-sm">
                    <span className="text-[var(--foreground)]">{r.materialCode}</span>
                    <span className="text-red-600 font-medium">Short {r.requiredQty - r.allocatedQty} (need {r.requiredQty}, have {r.allocatedQty})</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          {project.notes && (
            <div className="neo-panel-inset p-4">
              <h4 className="text-xs font-semibold text-[var(--foreground-muted)] mb-1">Notes</h4>
              <p className="text-sm text-[var(--foreground)] whitespace-pre-wrap">{project.notes}</p>
            </div>
          )}
        </div>
      )}

      {/* Client & Info — merges Client + Settings */}
      {activeTab === "Client & Info" && (
        <div className="space-y-6">
          <div className="neo-card p-6 sm:p-8">
            <ClientTab projectId={id} project={project} onUpdate={fetchProject} />
          </div>
          <div className="neo-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Project Settings</h3>
            <SettingsTab projectId={id} project={project} onUpdate={fetchProject} />
          </div>
        </div>
      )}

      {/* Estimates & Costs — type inputs + prerequisites + costs + quote */}
      {activeTab === "Estimates & Costs" && (
        <div className="space-y-6">
          {types.includes("vanity") && (
            <div className="neo-card p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Vanity Estimator</h3>
              <VanityTab projectId={id} project={project} onUpdate={fetchProject} />
            </div>
          )}
          {types.includes("side_unit") && (
            <div className="neo-card p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Side Unit Estimator</h3>
              <SideUnitTab projectId={id} project={project} onUpdate={fetchProject} />
            </div>
          )}
          {types.includes("kitchen") && (
            <div className="neo-card p-6 sm:p-8">
              <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Kitchen Estimator</h3>
              <KitchenTab projectId={id} project={project} onUpdate={fetchProject} />
            </div>
          )}
          <div className="neo-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Prerequisites & Materials</h3>
            <PrerequisitesTab projectId={id} project={project} onUpdate={fetchProject} />
          </div>
          <div className="neo-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Cost Lines</h3>
            <CostsTab projectId={id} project={project} onUpdate={fetchProject} />
          </div>
          <div className="neo-card p-6 sm:p-8">
            <h3 className="text-sm font-semibold text-[var(--foreground)] mb-4">Quote Summary</h3>
            <QuoteTab project={project} companyName={companyConfig.companyName} companyPhone={companyConfig.companyPhone} companyEmail={companyConfig.companyEmail} companyAddress={companyConfig.companyAddress} />
          </div>
        </div>
      )}

      {/* Production */}
      {activeTab === "Production" && (
        <div className="neo-card p-6 sm:p-8">
          <ProductionTab
            projectId={id}
            processTemplateId={project.processTemplate?.id ?? null}
          />
        </div>
      )}

      {/* Service Calls */}
      {activeTab === "Service Calls" && (
        <div className="neo-card p-6 sm:p-8">
          <ServiceCallsTab projectId={id} project={project} onUpdate={fetchProject} />
        </div>
      )}

      {/* History */}
      {activeTab === "History" && (
        <div className="neo-card p-6 sm:p-8">
          <AuditTab projectId={id} />
        </div>
      )}

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

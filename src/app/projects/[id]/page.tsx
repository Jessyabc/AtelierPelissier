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
      <div className="mb-4 flex flex-wrap items-center gap-3 sm:gap-4">
        <Link href="/" className="text-gray-600 hover:underline">
          ← Dashboard
        </Link>
        <h2 className="text-lg font-semibold text-gray-900">{project.name}</h2>
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

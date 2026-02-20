"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { ProcessCanvas } from "@/components/process-builder/ProcessCanvas";
import { NodeFormPanel } from "@/components/process-builder/NodeFormPanel";
import type { Node, Edge } from "@xyflow/react";
import type { ProcessNodeData } from "@/components/process-builder/ProcessCanvas";

type ProcessStep = {
  id: string;
  label: string;
  description: string | null;
  type: string;
  isOptional: boolean;
  positionX: number;
  positionY: number;
};

type ProcessStepEdge = {
  id: string;
  sourceStepId: string;
  targetStepId: string;
  conditionLabel: string | null;
};

type Template = {
  id: string;
  name: string;
  description: string | null;
  steps: ProcessStep[];
  edges: ProcessStepEdge[];
};

const VALID_NODE_TYPES = ["start", "step", "decision", "end"] as const;
function stepsToFlowNodes(steps: ProcessStep[]): Node<ProcessNodeData>[] {
  return steps.map((s) => ({
    id: s.id,
    type: (VALID_NODE_TYPES.includes(s.type as (typeof VALID_NODE_TYPES)[number])
      ? s.type
      : "step") as "start" | "step" | "decision" | "end",
    position: { x: s.positionX, y: s.positionY },
    data: {
      label: s.label,
      description: s.description,
      type: s.type,
      isOptional: s.isOptional,
    },
  }));
}

function edgesToFlowEdges(edges: ProcessStepEdge[]): Edge[] {
  return edges.map((e) => ({
    id: e.id,
    source: e.sourceStepId,
    target: e.targetStepId,
    ...(e.conditionLabel && { label: e.conditionLabel }),
  }));
}

function flowNodesToSteps(nodes: Node<ProcessNodeData>[], templateId: string): ProcessStep[] {
  return nodes.map((n) => ({
    id: n.id,
    templateId,
    label: (n.data as { label?: string })?.label ?? "Step",
    description: (n.data as { description?: string | null })?.description ?? null,
    type: (n.data as { type?: string })?.type ?? "step",
    isOptional: (n.data as { isOptional?: boolean })?.isOptional ?? false,
    positionX: n.position.x,
    positionY: n.position.y,
  }));
}

function flowEdgesToEdges(edges: Edge[], templateId: string): ProcessStepEdge[] {
  return edges.map((e) => ({
    id: e.id,
    templateId,
    sourceStepId: e.source,
    targetStepId: e.target,
    conditionLabel: typeof e.label === "string" ? e.label : null,
  }));
}

export default function ProcessBuilderPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateDescription, setTemplateDescription] = useState("");
  const [nodes, setNodes] = useState<Node<ProcessNodeData>[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/process-templates/${id}`);
      if (res.status === 404) {
        router.push("/processes");
        return;
      }
      const data = await res.json();
      setTemplate(data);
      setTemplateName(data.name);
      setTemplateDescription(data.description ?? "");
      setNodes(stepsToFlowNodes(data.steps ?? []));
      setEdges(edgesToFlowEdges(data.edges ?? []));
    } catch {
      setTemplate(null);
      router.push("/processes");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    loadTemplate();
  }, [loadTemplate]);

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedNodeId) ?? null,
    [nodes, selectedNodeId]
  );

  const outgoingEdgesForSelected = useMemo(() => {
    if (!selectedNodeId) return [];
    return edges
      .filter((e) => e.source === selectedNodeId)
      .map((e) => ({
        id: e.id,
        targetStepId: e.target,
        conditionLabel: typeof e.label === "string" ? e.label : null,
      }));
  }, [edges, selectedNodeId]);

  const handleUpdateNode = useCallback(
    (nodeId: string, data: Partial<{ label: string; description?: string | null; type?: string; isOptional?: boolean }>) => {
      setNodes((nds) =>
        nds.map((n) => {
          if (n.id !== nodeId) return n;
          const existing = n.data as ProcessNodeData;
          const merged: ProcessNodeData = {
            label: data.label ?? existing.label ?? "Step",
            description: data.description !== undefined ? data.description : existing.description,
            type: data.type ?? existing.type,
            isOptional: data.isOptional ?? existing.isOptional,
          };
          return { ...n, data: merged };
        })
      );
    },
    []
  );

  const handleEdgeLabelChange = useCallback(
    (edgeId: string, conditionLabel: string) => {
      setEdges((eds) =>
        eds.map((e) =>
          e.id === edgeId ? { ...e, label: conditionLabel || undefined } : e
        )
      );
    },
    []
  );

  const handleAddNode = useCallback((type: "start" | "step" | "decision" | "end") => {
    const newId = crypto.randomUUID();
    const baseX = 200 + Math.random() * 100;
    const baseY = nodes.length * 120 + 50;
    const newNode: Node<ProcessNodeData> = {
      id: newId,
      type,
      position: { x: baseX, y: baseY },
      data: {
        label: type === "start" ? "Start" : type === "decision" ? "Decision" : type === "end" ? "End" : "New step",
        type,
        isOptional: false,
      },
    };
    setNodes((nds) => [...nds, newNode]);
  }, [nodes.length]);

  const handleSave = useCallback(async () => {
    if (!template) return;
    setSaving(true);
    try {
      const stepsPayload = flowNodesToSteps(nodes, template.id).map(
        (s) =>
          ({ id: s.id, label: s.label, description: s.description, type: s.type, isOptional: s.isOptional, positionX: s.positionX, positionY: s.positionY }) as const
      );
      const edgesPayload = flowEdgesToEdges(edges, template.id).map(
        (e) =>
          ({ id: e.id, sourceStepId: e.sourceStepId, targetStepId: e.targetStepId, conditionLabel: e.conditionLabel }) as const
      );
      const res = await fetch(`/api/process-templates/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: templateName.trim(),
          description: templateDescription.trim() || null,
          steps: stepsPayload,
          edges: edgesPayload,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err?.error || "Save failed");
      }
      toast.success("Process saved");
      const data = await res.json();
      setTemplate(data);
      setNodes(stepsToFlowNodes(data.steps ?? []));
      setEdges(edgesToFlowEdges(data.edges ?? []));
    } catch (err) {
      toast.error((err as Error)?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  }, [template, id, templateName, templateDescription, nodes, edges]);

  if (loading) {
    return (
      <div className="neo-card p-8">
        <p className="text-gray-600">Loading process…</p>
      </div>
    );
  }

  if (!template) return null;

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-8rem)]">
      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/processes"
          className="neo-btn px-4 py-2 text-sm font-medium"
        >
          ← Back
        </Link>
        <input
          type="text"
          value={templateName}
          onChange={(e) => setTemplateName(e.target.value)}
          className="neo-input px-4 py-2 text-lg font-medium min-w-[200px]"
          placeholder="Process name"
        />
        <input
          type="text"
          value={templateDescription}
          onChange={(e) => setTemplateDescription(e.target.value)}
          className="neo-input px-4 py-2 text-sm min-w-[160px]"
          placeholder="Description"
        />
        <div className="flex gap-2 ml-auto">
          <button
            type="button"
            onClick={() => handleAddNode("start")}
            className="neo-btn px-3 py-2 text-sm"
          >
            Add start
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("step")}
            className="neo-btn px-3 py-2 text-sm"
          >
            Add step
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("decision")}
            className="neo-btn px-3 py-2 text-sm"
          >
            Add decision
          </button>
          <button
            type="button"
            onClick={() => handleAddNode("end")}
            className="neo-btn px-3 py-2 text-sm"
          >
            Add end
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="neo-btn-primary px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-4 min-h-0">
        <div className="flex-1 min-w-0 relative">
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <div className="neo-card px-6 py-4 text-center">
                <p className="text-sm text-gray-600">No steps yet. Add a start, step, decision, or end from the toolbar.</p>
              </div>
            </div>
          )}
          <ProcessCanvas
            key={template.id}
            nodes={nodes}
            edges={edges}
            onNodesChange={setNodes}
            onEdgesChange={setEdges}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            readOnly={false}
          />
        </div>
        <NodeFormPanel
          node={selectedNode}
          onUpdate={handleUpdateNode}
          outgoingEdges={outgoingEdgesForSelected}
          onEdgeLabelChange={handleEdgeLabelChange}
        />
      </div>
    </div>
  );
}

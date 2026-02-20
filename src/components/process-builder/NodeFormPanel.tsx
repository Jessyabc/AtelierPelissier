"use client";

import { useCallback, useEffect, useState } from "react";
import type { Node } from "@xyflow/react";
import type { ProcessNodeData } from "./ProcessCanvas";

export type NodeFormPanelProps = {
  node: Node<ProcessNodeData> | null;
  onUpdate: (nodeId: string, data: Partial<ProcessNodeData> & { type?: string }) => void;
  outgoingEdges?: Array<{ id: string; targetStepId: string; conditionLabel: string | null }>;
  onEdgeLabelChange?: (edgeId: string, conditionLabel: string) => void;
};

const STEP_TYPES = [
  { value: "start", label: "Start" },
  { value: "step", label: "Step" },
  { value: "decision", label: "Decision" },
  { value: "end", label: "End" },
] as const;

export function NodeFormPanel({
  node,
  onUpdate,
  outgoingEdges = [],
  onEdgeLabelChange,
}: NodeFormPanelProps) {
  const [label, setLabel] = useState(node?.data?.label ?? "");
  const [description, setDescription] = useState(node?.data?.description ?? "");
  const [type, setType] = useState(node?.data?.type ?? "step");
  const [isOptional, setIsOptional] = useState(node?.data?.isOptional ?? false);

  useEffect(() => {
    setLabel(node?.data?.label ?? "");
    setDescription(node?.data?.description ?? "");
    setType(node?.data?.type ?? "step");
    setIsOptional(node?.data?.isOptional ?? false);
  }, [node?.id, node?.data?.label, node?.data?.description, node?.data?.type, node?.data?.isOptional]);

  const apply = useCallback(
    (updates: Partial<ProcessNodeData> & { type?: string }) => {
      if (node) onUpdate(node.id, updates);
    },
    [node, onUpdate]
  );

  const handleLabelBlur = useCallback(() => {
    const trimmed = label.trim();
    if (trimmed) apply({ label: trimmed });
  }, [label, apply]);

  const handleDescriptionBlur = useCallback(() => {
    apply({ description: description.trim() || null });
  }, [description, apply]);

  const handleTypeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      const v = e.target.value as "start" | "step" | "decision" | "end";
      setType(v);
      apply({ type: v });
    },
    [apply]
  );

  const handleOptionalChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.checked;
      setIsOptional(v);
      apply({ isOptional: v });
    },
    [apply]
  );

  if (!node) {
    return (
      <div className="neo-card p-6 w-80 shrink-0">
        <p className="text-sm text-gray-500">Select a node to edit its properties.</p>
      </div>
    );
  }

  return (
    <div className="neo-card p-6 w-80 shrink-0 space-y-4">
      <h3 className="font-medium text-gray-900">Edit step</h3>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
        <input
          type="text"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          onBlur={handleLabelBlur}
          className="neo-input w-full px-3 py-2 text-sm"
          placeholder="Step name"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          onBlur={handleDescriptionBlur}
          className="neo-input w-full px-3 py-2 text-sm min-h-[80px]"
          placeholder="Optional notes"
          rows={3}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
        <select
          value={type}
          onChange={handleTypeChange}
          className="neo-select w-full px-3 py-2 text-sm"
        >
          {STEP_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="optional"
          checked={isOptional}
          onChange={handleOptionalChange}
          className="rounded border-gray-300"
        />
        <label htmlFor="optional" className="text-sm text-gray-700">
          Optional step
        </label>
      </div>

      {type === "decision" && outgoingEdges.length > 0 && (
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-2">
            Branch labels
          </label>
          <div className="space-y-2">
            {outgoingEdges.map((e) => (
              <div key={e.id} className="flex items-center gap-2">
                <input
                  type="text"
                  value={e.conditionLabel ?? ""}
                  onChange={(ev) => onEdgeLabelChange?.(e.id, ev.target.value)}
                  className="neo-input flex-1 px-2 py-1.5 text-sm"
                  placeholder="e.g. Yes, No"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

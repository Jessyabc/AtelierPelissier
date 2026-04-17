"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type StepNodeData = {
  label: string;
  description?: string | null;
  type: string;
  isOptional?: boolean;
  estimatedMinutes?: number | null;
};

function formatMinutes(min: number): string {
  if (min <= 0) return "";
  const hours = Math.floor(min / 60);
  const mins = min % 60;
  if (hours === 0) return `${mins} min`;
  if (mins === 0) return `${hours} h`;
  return `${hours} h ${mins} min`;
}

function StepNodeComponent({ data, selected }: NodeProps<Node<StepNodeData>>) {
  const isOptional = data.isOptional ?? false;
  const minutes = data.estimatedMinutes;
  return (
    <div
      className={`neo-card rounded-xl px-4 py-3 min-w-[140px] text-center ${
        isOptional ? "border-2 border-dashed border-gray-400" : ""
      } ${selected ? "ring-2 ring-[var(--accent-hover)]" : ""}`}
    >
      <div className="text-gray-900 font-medium text-sm">{data.label || "Step"}</div>
      {isOptional && (
        <span className="text-xs text-gray-500 block mt-1">Optional</span>
      )}
      {typeof minutes === "number" && minutes > 0 && (
        <span className="text-[11px] text-gray-500 block mt-0.5">
          ⏱ {formatMinutes(minutes)}
        </span>
      )}
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !top-[-6px]" />
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bottom-[-6px]" />
    </div>
  );
}

export const StepNode = memo(StepNodeComponent);

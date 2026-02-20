"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type StartNodeData = {
  label: string;
  description?: string | null;
  isOptional?: boolean;
};

function StartNodeComponent({ data, selected }: NodeProps<Node<StartNodeData>>) {
  return (
    <div
      className={`rounded-xl px-4 py-3 min-w-[140px] text-center font-medium ${
        selected ? "ring-2 ring-[var(--accent-hover)]" : ""
      }`}
      style={{
        background: "linear-gradient(145deg, #51ff7d 0%, #3ee065 100%)",
        boxShadow: selected
          ? "inset 2px 2px 4px rgba(0,0,0,0.1), 6px 6px 12px var(--shadow-dark)"
          : "5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light)",
      }}
    >
      <div className="text-gray-900 text-sm">{data.label || "Start"}</div>
      <Handle type="source" position={Position.Bottom} className="!w-3 !h-3 !bottom-[-6px]" />
    </div>
  );
}

export const StartNode = memo(StartNodeComponent);

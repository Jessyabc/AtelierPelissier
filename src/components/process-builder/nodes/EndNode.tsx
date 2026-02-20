"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type EndNodeData = {
  label: string;
  description?: string | null;
  isOptional?: boolean;
};

function EndNodeComponent({ data, selected }: NodeProps<Node<EndNodeData>>) {
  return (
    <div
      className={`rounded-xl px-4 py-3 min-w-[140px] text-center font-medium ${
        selected ? "ring-2 ring-[var(--accent-hover)]" : ""
      }`}
      style={{
        background: "linear-gradient(145deg, #94a3b8 0%, #64748b 100%)",
        boxShadow: selected
          ? "inset 2px 2px 4px rgba(0,0,0,0.2), 6px 6px 12px var(--shadow-dark)"
          : "5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light)",
      }}
    >
      <div className="text-white text-sm">{data.label || "End"}</div>
      <Handle type="target" position={Position.Top} className="!w-3 !h-3 !top-[-6px]" />
    </div>
  );
}

export const EndNode = memo(EndNodeComponent);

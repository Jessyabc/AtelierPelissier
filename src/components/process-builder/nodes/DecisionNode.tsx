"use client";

import { memo } from "react";
import { Handle, Position, type NodeProps, type Node } from "@xyflow/react";

export type DecisionNodeData = {
  label: string;
  description?: string | null;
  type: string;
  isOptional?: boolean;
};

function DecisionNodeComponent({ data, selected }: NodeProps<Node<DecisionNodeData>>) {
  return (
    <div
      className={`relative flex items-center justify-center ${
        selected ? "ring-2 ring-[var(--accent-hover)]" : ""
      }`}
      style={{
        width: 100,
        height: 100,
      }}
    >
      <div
        className="absolute w-[71px] h-[71px] left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rotate-45 pointer-events-none"
        style={{
          background: "var(--bg)",
          boxShadow: "5px 5px 10px var(--shadow-dark), -5px -5px 10px var(--shadow-light)",
        }}
      />
      <div className="relative z-10 -rotate-45 text-gray-900 font-medium text-xs text-center px-2 max-w-[70px] pointer-events-none">
        {data.label || "Decision"}
      </div>
      {/* Handles need z-20 and no pointer-events-none so they stay interactive */}
      <Handle
        type="target"
        position={Position.Top}
        className="!w-3 !h-3 !top-[-6px] !z-20"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="out"
        className="!w-3 !h-3 !bottom-[-6px] !z-20"
      />
    </div>
  );
}

export const DecisionNode = memo(DecisionNodeComponent);

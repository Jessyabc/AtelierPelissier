"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
  type Edge,
  type Node,
  type NodeChange,
  type EdgeChange,
  Background,
  Controls,
  MiniMap,
  type OnConnect,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { StartNode } from "./nodes/StartNode";
import { StepNode } from "./nodes/StepNode";
import { DecisionNode } from "./nodes/DecisionNode";
import { EndNode } from "./nodes/EndNode";

export type ProcessNodeData = {
  label: string;
  description?: string | null;
  type?: string;
  isOptional?: boolean;
};

const nodeTypes: NodeTypes = {
  start: StartNode,
  step: StepNode,
  decision: DecisionNode,
  end: EndNode,
};

export type ProcessCanvasProps = {
  nodes: Node<ProcessNodeData>[];
  edges: Edge[];
  onNodesChange: (nodes: Node<ProcessNodeData>[]) => void;
  onEdgesChange: (edges: Edge[]) => void;
  selectedNodeId?: string | null;
  onNodeSelect?: (nodeId: string | null) => void;
  readOnly?: boolean;
};

export function ProcessCanvas({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  selectedNodeId,
  onNodeSelect,
  readOnly = false,
}: ProcessCanvasProps) {
  const handleNodesChange = useCallback(
    (changes: NodeChange[]) => {
      const next = applyNodeChanges(changes, nodes) as Node<ProcessNodeData>[];
      onNodesChange(next);
    },
    [nodes, onNodesChange]
  );

  const handleEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      const next = applyEdgeChanges(changes, edges);
      onEdgesChange(next);
    },
    [edges, onEdgesChange]
  );

  const handleConnect = useCallback(
    (params: Connection) => {
      const next = addEdge(params, edges);
      onEdgesChange(next);
    },
    [edges, onEdgesChange]
  );

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      onNodeSelect?.(node.id);
    },
    [onNodeSelect]
  );

  const handlePaneClick = useCallback(() => {
    onNodeSelect?.(null);
  }, [onNodeSelect]);

  return (
    <div className="w-full h-full min-h-[400px] rounded-xl overflow-hidden bg-[var(--bg)]">
      <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={handleNodesChange}
        onEdgesChange={handleEdgesChange}
        onConnect={readOnly ? undefined : handleConnect}
        onNodeClick={handleNodeClick}
        onPaneClick={handlePaneClick}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        connectOnClick={!readOnly}
      >
        <Background />
        <Controls />
        <MiniMap />
      </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
}

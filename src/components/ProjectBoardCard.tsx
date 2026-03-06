"use client";

import Link from "next/link";

type TaskItem = { id: string; label: string; isDone: boolean; sortOrder: number };

type Props = {
  id: string;
  label: string;
  badge: string;
  badgeVariant: "gray" | "accent";
  processTemplate?: { id: string; name: string } | null;
  doneCount: number;
  totalCount: number;
  currentStep: string;
  isExpanded: boolean;
  onToggleExpand: () => void;
  taskItems: TaskItem[];
  onToggleTask: (taskId: string) => void;
  addingStep: boolean;
  newStepLabel: string;
  onNewStepChange: (v: string) => void;
  onAddStep: () => void;
  onCancelAddStep: () => void;
  onStartAddStep: () => void;
  onDelete?: () => void;
};

export function ProjectBoardCard({
  id,
  label,
  badge,
  badgeVariant,
  processTemplate,
  doneCount,
  totalCount,
  currentStep,
  isExpanded,
  onToggleExpand,
  taskItems,
  onToggleTask,
  addingStep,
  newStepLabel,
  onNewStepChange,
  onAddStep,
  onCancelAddStep,
  onStartAddStep,
  onDelete,
}: Props) {
  const badgeClass =
    badgeVariant === "accent"
      ? "bg-[var(--accent)]/15 text-[var(--accent)] px-2 py-0.5 text-xs font-medium rounded-md"
      : "bg-gray-200 text-gray-700 px-2 py-0.5 text-xs font-medium rounded-md";

  return (
    <div className="rounded-lg border border-gray-200 overflow-hidden">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center justify-between gap-2 p-3 text-left hover:bg-gray-50/50"
      >
        <div className="min-w-0">
          <span className={`inline-block ${badgeClass} mb-1 capitalize`}>{badge}</span>
          <p className="font-medium text-gray-900">{label}</p>
          <p className="mt-0.5 text-xs text-gray-600 truncate">
            {totalCount > 0 ? `${doneCount}/${totalCount} · ` : ""}
            Current: {currentStep}
          </p>
        </div>
        <span className="text-gray-400 shrink-0">{isExpanded ? "▼" : "▶"}</span>
      </button>
      {isExpanded && (
        <div className="border-t border-gray-200 p-3 bg-gray-50/30">
          {processTemplate && (
            <Link
              href={`/processes/${processTemplate.id}`}
              className="text-xs text-[var(--accent-hover)] hover:underline mb-2 inline-block"
            >
              {processTemplate.name}
            </Link>
          )}
          <ul className="space-y-1.5">
            {taskItems.map((task) => (
              <li key={task.id} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={task.isDone}
                  onChange={() => onToggleTask(task.id)}
                  className="rounded border-gray-300"
                />
                <span
                  className={
                    task.isDone ? "text-gray-500 line-through text-sm" : "text-sm text-gray-800"
                  }
                >
                  {task.label}
                </span>
              </li>
            ))}
          </ul>
          {addingStep ? (
            <div className="flex gap-2 mt-2">
              <input
                type="text"
                value={newStepLabel}
                onChange={(e) => onNewStepChange(e.target.value)}
                placeholder="New step"
                className="neo-input flex-1 px-2 py-1.5 text-sm"
                onKeyDown={(e) => e.key === "Enter" && onAddStep()}
              />
              <button
                type="button"
                onClick={onAddStep}
                disabled={!newStepLabel.trim()}
                className="neo-btn px-2 py-1.5 text-xs"
              >
                Add
              </button>
              <button type="button" onClick={onCancelAddStep} className="neo-btn px-2 py-1.5 text-xs">
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 mt-2">
              <button
                type="button"
                onClick={onStartAddStep}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                + Add step
              </button>
              {onDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="text-xs text-red-600 hover:underline"
                >
                  Remove
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

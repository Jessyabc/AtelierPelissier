"use client";

import { useEffect, useState } from "react";

type AuditLogEntry = {
  id: string;
  action: string;
  details: string | null;
  createdAt: string;
};

function labelForAction(action: string): string {
  const labels: Record<string, string> = {
    created: "Project created",
    saved: "Project saved",
    client_updated: "Client info updated",
    cost_added: "Cost line added",
    cost_updated: "Cost line updated",
    cost_deleted: "Cost line removed",
    settings_updated: "Settings updated",
    vanity_updated: "Vanity config updated",
    side_unit_updated: "Side unit config updated",
    kitchen_updated: "Kitchen config updated",
    service_call_updated: "Service call updated",
    duplicated: "Duplicated from another project",
    deleted: "Project deleted",
  };
  return labels[action] ?? action.replace(/_/g, " ");
}

export function AuditTab({ projectId }: { projectId: string }) {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/projects/${projectId}/audit`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load");
        return res.json();
      })
      .then((data) => setLogs(Array.isArray(data) ? data : []))
      .catch(() => setError("Could not load history"))
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) return <p className="text-gray-600">Loading history…</p>;
  if (error) return <p className="text-red-600">{error}</p>;
  if (logs.length === 0) {
    return (
      <p className="text-gray-500">No history yet. Changes to this project will appear here.</p>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Recent changes to this project.</p>
      <ul className="space-y-2">
        {logs.map((log) => (
          <li
            key={log.id}
            className="flex flex-wrap items-baseline gap-2 rounded border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
          >
            <span className="font-medium text-gray-800">{labelForAction(log.action)}</span>
            {log.details && <span className="text-gray-500">— {log.details}</span>}
            <span className="ml-auto text-gray-400">
              {new Date(log.createdAt).toLocaleString("en-CA")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

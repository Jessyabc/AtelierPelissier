"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

const PROJECT_TYPES = [
  { value: "vanity", label: "Vanity" },
  { value: "side_unit", label: "Side Unit" },
  { value: "kitchen", label: "Kitchen" },
] as const;

type TaskDraft = { name: string; items: string[]; processTemplateId?: string };

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["vanity"]);
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [tasks, setTasks] = useState<TaskDraft[]>([]);
  const [newTaskName, setNewTaskName] = useState("");
  const [newTaskItems, setNewTaskItems] = useState("");
  const [newTaskProcessId, setNewTaskProcessId] = useState("");
  const [processTemplates, setProcessTemplates] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function toggleType(value: string) {
    setSelectedTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value];
      return next.length ? next : ["vanity"];
    });
  }

  function addTask() {
    if (!newTaskName.trim()) return;
    const items = newTaskItems.split("\n").map((s) => s.trim()).filter(Boolean);
    setTasks((t) => [
      ...t,
      { name: newTaskName.trim(), items, processTemplateId: newTaskProcessId.trim() || undefined },
    ]);
    setNewTaskName("");
    setNewTaskItems("");
    setNewTaskProcessId("");
  }

  function removeTask(idx: number) {
    setTasks((t) => t.filter((_, i) => i !== idx));
  }

  useEffect(() => {
    fetch("/api/process-templates")
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setProcessTemplates(Array.isArray(data) ? data : []))
      .catch(() => setProcessTemplates([]));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setFieldErrors({});
    if (!name.trim()) {
      setError("Project name is required.");
      return;
    }
    if (selectedTypes.length === 0) {
      setError("Select at least one project type.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          types: selectedTypes,
          clientFirstName: clientFirstName.trim() || undefined,
          clientLastName: clientLastName.trim() || undefined,
          clientEmail: clientEmail.trim() || undefined,
          clientPhone: clientPhone.trim() || undefined,
          clientAddress: clientAddress.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const issues = data.issues as Record<string, string[] | undefined> | undefined;
        if (issues) setFieldErrors(issues as Record<string, string[]>);
        throw new Error(data.error || "Validation failed");
      }
      for (const task of tasks) {
        await fetch(`/api/projects/${data.id}/sub-projects`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: task.name,
            items: task.items,
            processTemplateId: task.processTemplateId,
          }),
        });
      }
      router.push(`/projects/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create project");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <h2 className="mb-4 text-lg font-medium text-gray-800">New Project</h2>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="name" className="mb-1 block text-sm font-medium text-gray-700">
            Project name
          </label>
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={`neo-input w-full px-4 py-2.5 ${fieldErrors.name ? "ring-2 ring-red-400" : ""}`}
            placeholder="e.g. Main bath vanity"
            aria-invalid={!!fieldErrors.name}
            aria-describedby={fieldErrors.name ? "name-error" : undefined}
          />
          {fieldErrors.name && (
            <p id="name-error" className="mt-1 text-sm text-red-600">{fieldErrors.name.join(", ")}</p>
          )}
        </div>

        <div>
          <span className="mb-2 block text-sm font-medium text-gray-700">
            Project type (select all that apply)
          </span>
          <div className="flex flex-wrap gap-3">
            {PROJECT_TYPES.map(({ value, label }) => (
              <label key={value} className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={selectedTypes.includes(value)}
                  onChange={() => toggleType(value)}
                  className="h-4 w-4 rounded border-gray-300"
                />
                <span className="text-sm text-gray-800">{label}</span>
              </label>
            ))}
          </div>
          {fieldErrors.types && (
            <p className="mt-1 text-sm text-red-600">{fieldErrors.types.join(", ")}</p>
          )}
        </div>

        <fieldset className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <legend className="text-sm font-medium text-gray-700">Client information</legend>
          <p className="mb-3 text-xs text-gray-500">
            Optional now; required when you save the project.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="clientFirstName" className="mb-0.5 block text-xs font-medium text-gray-600">
                First name
              </label>
              <input
                id="clientFirstName"
                type="text"
                value={clientFirstName}
                onChange={(e) => setClientFirstName(e.target.value)}
                className="w-full neo-input px-4 py-2.5 text-sm"
                placeholder="First name"
              />
            </div>
            <div>
              <label htmlFor="clientLastName" className="mb-0.5 block text-xs font-medium text-gray-600">
                Last name
              </label>
              <input
                id="clientLastName"
                type="text"
                value={clientLastName}
                onChange={(e) => setClientLastName(e.target.value)}
                className="w-full neo-input px-4 py-2.5 text-sm"
                placeholder="Last name"
              />
            </div>
          </div>
          <div className="mt-3">
            <label htmlFor="clientEmail" className="mb-0.5 block text-xs font-medium text-gray-600">
              Email
            </label>
            <input
              id="clientEmail"
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="client@example.com"
            />
          </div>
          <div className="mt-3">
            <label htmlFor="clientPhone" className="mb-0.5 block text-xs font-medium text-gray-600">
              Phone
            </label>
            <input
              id="clientPhone"
              type="tel"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="(555) 000-0000"
            />
          </div>
          <div className="mt-3">
            <label htmlFor="clientAddress" className="mb-0.5 block text-xs font-medium text-gray-600">
              Address
            </label>
            <textarea
              id="clientAddress"
              value={clientAddress}
              onChange={(e) => setClientAddress(e.target.value)}
              rows={2}
              className="w-full neo-input px-4 py-2.5 text-sm"
              placeholder="Street, city, postal code"
            />
          </div>
        </fieldset>

        <fieldset className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
          <legend className="text-sm font-medium text-gray-700">Tasks (optional)</legend>
          <p className="mb-3 text-xs text-gray-500">
            Add tasks with checklist items now, or add them later from the project page.
          </p>
          {tasks.length > 0 && (
            <ul className="mb-3 space-y-2">
              {tasks.map((t, i) => (
                <li key={i} className="flex items-center justify-between gap-2 rounded bg-white px-3 py-2 text-sm">
                  <div>
                    <span className="font-medium">{t.name}</span>
                    {t.processTemplateId && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({processTemplates.find((p) => p.id === t.processTemplateId)?.name ?? "process"})
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {t.items.length > 0 && (
                      <span className="text-gray-500 text-xs">{t.items.length} items</span>
                    )}
                    <button
                    type="button"
                    onClick={() => removeTask(i)}
                      className="text-red-600 text-xs hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <div className="space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={newTaskName}
                onChange={(e) => setNewTaskName(e.target.value)}
                placeholder="Task name"
                className="neo-input flex-1 px-3 py-2 text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTask())}
              />
              <select
                value={newTaskProcessId}
                onChange={(e) => setNewTaskProcessId(e.target.value)}
                className="neo-input w-40 px-3 py-2 text-sm shrink-0"
                title="Link to process"
              >
                <option value="">No process</option>
                {processTemplates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={addTask}
                disabled={!newTaskName.trim()}
                className="neo-btn px-3 py-2 text-sm shrink-0"
              >
                Add task
              </button>
            </div>
          </div>
          {newTaskName.trim() && (
            <textarea
              value={newTaskItems}
              onChange={(e) => setNewTaskItems(e.target.value)}
              placeholder="Items (one per line)"
              rows={2}
              className="neo-input mt-2 w-full px-3 py-2 text-sm"
            />
          )}
        </fieldset>

        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <button
            type="submit"
            disabled={loading}
            className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {loading ? "Creating…" : "Create project (draft)"}
          </button>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="neo-btn px-4 py-2 text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}

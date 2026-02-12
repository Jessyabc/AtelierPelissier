"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const PROJECT_TYPES = [
  { value: "vanity", label: "Vanity" },
  { value: "side_unit", label: "Side Unit" },
  { value: "kitchen", label: "Kitchen" },
] as const;

export default function NewProjectPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [selectedTypes, setSelectedTypes] = useState<string[]>(["vanity"]);
  const [clientFirstName, setClientFirstName] = useState("");
  const [clientLastName, setClientLastName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  function toggleType(value: string) {
    setSelectedTypes((prev) => {
      const next = prev.includes(value) ? prev.filter((t) => t !== value) : [...prev, value];
      return next.length ? next : ["vanity"];
    });
  }

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

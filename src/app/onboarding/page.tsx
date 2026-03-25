"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type EmployeeOpt = { id: string; name: string; email: string | null; role: string; active?: boolean };

export default function OnboardingPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<EmployeeOpt[]>([]);
  const [employeeId, setEmployeeId] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/auth/me").then((r) => r.json()),
      fetch("/api/employees").then((r) => r.json()),
    ])
      .then(([me, emps]) => {
        if (me.user?.name) setName(me.user.name);
        if (Array.isArray(emps)) {
          setEmployees(emps.filter((e: EmployeeOpt) => e.active !== false));
        }
      })
      .catch(() => setError("Failed to load data"))
      .finally(() => setLoading(false));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: employeeId || null,
          name: name.trim() || null,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setError((j as { error?: string }).error ?? "Save failed");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg py-12 text-center text-slate-400">
        Loading…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg rounded-xl border border-slate-800 bg-slate-900/80 p-6">
      <h1 className="text-xl font-semibold text-white">Welcome to WoodOps</h1>
      <p className="mt-2 text-sm text-slate-400">
        Link your account to a team member (optional) and confirm your display name.
      </p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm text-slate-300">Your name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
            placeholder="Display name"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm text-slate-300">Link to employee (optional)</label>
          <select
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className="w-full rounded border border-slate-700 bg-slate-950 px-3 py-2 text-white"
          >
            <option value="">— Skip —</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.role}){e.email ? ` — ${e.email}` : ""}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-amber-400">{error}</p>}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded bg-amber-600 py-2 font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </form>
    </div>
  );
}

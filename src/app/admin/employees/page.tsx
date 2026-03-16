"use client";

import { useEffect, useState, useCallback } from "react";

type Employee = { id: string; name: string; email: string | null; role: string; color: string; active: boolean };

const ROLE_LABELS: Record<string, string> = {
  salesperson: "Sales",
  woodworker: "Woodworker",
  admin: "Admin",
};

const COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e",
  "#f97316", "#eab308", "#22c55e", "#14b8a6",
  "#0ea5e9", "#64748b",
];

const EMPTY_FORM = { name: "", email: "", role: "woodworker", color: "#6366f1" };

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/employees");
    setEmployees(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function startEdit(emp: Employee) {
    setForm({ name: emp.name, email: emp.email ?? "", role: emp.role, color: emp.color });
    setEditingId(emp.id);
    setShowForm(true);
  }

  function startNew() {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    if (editingId) {
      await fetch(`/api/employees/${editingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    } else {
      await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
    }
    setSaving(false);
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY_FORM);
    load();
  }

  async function toggleActive(emp: Employee) {
    await fetch(`/api/employees/${emp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !emp.active }),
    });
    load();
  }

  const salespeople = employees.filter((e) => e.role === "salesperson");
  const woodworkers = employees.filter((e) => e.role === "woodworker");
  const admins = employees.filter((e) => e.role === "admin");

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team Members</h1>
          <p className="text-sm text-gray-500 mt-1">Salespeople, woodworkers and admin staff</p>
        </div>
        <button
          onClick={startNew}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
        >
          + Add employee
        </button>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="mb-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{editingId ? "Edit employee" : "New employee"}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Mario Tremblay"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Email</label>
              <input
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="mario@evos.ca"
                type="email"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Role *</label>
              <select
                value={form.role}
                onChange={(e) => setForm({ ...form, role: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="woodworker">Woodworker</option>
                <option value="salesperson">Salesperson</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-xs text-gray-500 mb-2">Display color</label>
            <div className="flex gap-2 flex-wrap">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setForm({ ...form, color: c })}
                  className="w-7 h-7 rounded-full transition-transform hover:scale-110"
                  style={{ backgroundColor: c, outline: form.color === c ? `3px solid ${c}` : "none", outlineOffset: 2 }}
                />
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving || !form.name.trim()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : (
        <div className="space-y-6">
          {[{ label: "Salespeople", list: salespeople }, { label: "Woodworkers", list: woodworkers }, { label: "Admin", list: admins }].map(({ label, list }) =>
            list.length === 0 ? null : (
              <div key={label}>
                <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">{label}</h2>
                <div className="rounded-xl border border-gray-200 bg-white divide-y divide-gray-100 overflow-hidden">
                  {list.map((emp) => (
                    <div key={emp.id} className={`flex items-center gap-3 px-4 py-3 ${emp.active ? "" : "opacity-50"}`}>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: emp.color }}>
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{emp.name}</p>
                        {emp.email && <p className="text-xs text-gray-400 truncate">{emp.email}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${emp.active ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-400"}`}>
                        {emp.active ? "Active" : "Inactive"}
                      </span>
                      <button
                        onClick={() => startEdit(emp)}
                        className="text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => toggleActive(emp)}
                        className="text-xs text-gray-400 hover:text-gray-600"
                      >
                        {emp.active ? "Deactivate" : "Activate"}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

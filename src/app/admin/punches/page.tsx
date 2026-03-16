"use client";

import { useEffect, useState, useCallback } from "react";

type Punch = {
  id: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  employee: { id: string; name: string; color: string };
  station: { id: string; name: string } | null;
  project: { id: string; name: string; jobNumber: string | null } | null;
};

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null, startTime: string, endTime: string | null) {
  if (!endTime) {
    const live = Math.round((Date.now() - new Date(startTime).getTime()) / 60000);
    return `${live}m (active)`;
  }
  if (minutes === null) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

export default function PunchesPage() {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [activePunches, setActivePunches] = useState<Punch[]>([]);
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 30000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    const [dayRes, activeRes] = await Promise.all([
      fetch(`/api/time-punches?date=${date}`),
      fetch("/api/time-punches/active"),
    ]);
    setPunches(await dayRes.json());
    setActivePunches(await activeRes.json());
    setLoading(false);
  }, [date]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { load(); }, [tick, load]);

  async function clockOut(punchId: string) {
    await fetch(`/api/time-punches/${punchId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    load();
  }

  async function deleteP(punchId: string) {
    if (!confirm("Delete this punch?")) return;
    await fetch(`/api/time-punches/${punchId}`, { method: "DELETE" });
    load();
  }

  const completedPunches = punches.filter((p) => p.endTime !== null);
  const totalMinutes = completedPunches.reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Punch Board</h1>
          <p className="text-sm text-gray-500 mt-1">Track who&apos;s on the floor and review daily hours</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Active now */}
      {activePunches.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">On the floor right now</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePunches.map((p) => (
              <div key={p.id} className="rounded-xl border border-green-200 bg-green-50 p-3 flex items-center gap-3">
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shrink-0" style={{ backgroundColor: p.employee.color }}>
                  {p.employee.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900 truncate">{p.employee.name}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {p.station?.name ?? "—"}{p.project ? ` · ${p.project.jobNumber ?? p.project.name}` : ""}
                  </p>
                  <p className="text-xs text-green-600 font-mono" suppressHydrationWarning>
                    {formatDuration(null, p.startTime, null)}
                  </p>
                </div>
                <button
                  onClick={() => clockOut(p.id)}
                  className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0"
                >
                  Clock out
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Day summary */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {date === today() ? "Today" : date} — {completedPunches.length} punches completed
        </h2>
        {completedPunches.length > 0 && (
          <span className="text-sm font-semibold text-gray-700">{totalHours}h total</span>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-gray-400">Loading...</p>
      ) : completedPunches.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No completed punches for this date.</p>
        </div>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Employee</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Station</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Job</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">Start</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500">End</th>
                <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500">Duration</th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {completedPunches.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white" style={{ backgroundColor: p.employee.color }}>
                        {p.employee.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{p.employee.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.station?.name ?? <span className="text-gray-300">—</span>}</td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                    {p.project ? (p.project.jobNumber ? `${p.project.jobNumber}` : p.project.name) : <span className="text-gray-300">General</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{formatTime(p.startTime)}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{p.endTime ? formatTime(p.endTime) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-700">{formatDuration(p.durationMinutes, p.startTime, p.endTime)}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => deleteP(p.id)} className="text-xs text-gray-300 hover:text-red-500 transition-colors">✕</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

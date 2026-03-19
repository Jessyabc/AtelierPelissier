"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";

type Punch = {
  id: string;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
  notes: string | null;
  employee: { id: string; name: string; color: string };
  station: { id: string; name: string; slug: string } | null;
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

async function parseJsonArray(res: Response): Promise<Punch[]> {
  const text = await res.text();
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try {
      const j = JSON.parse(text) as { error?: string };
      if (j.error) msg = j.error;
    } catch {
      if (text.trim()) msg = text.slice(0, 160);
    }
    throw new Error(msg);
  }
  try {
    const data = JSON.parse(text) as unknown;
    return Array.isArray(data) ? (data as Punch[]) : [];
  } catch {
    return [];
  }
}

export default function PunchesPage() {
  const [punches, setPunches] = useState<Punch[]>([]);
  const [activePunches, setActivePunches] = useState<Punch[]>([]);
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(true);
  const [stoppingId, setStoppingId] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    setOrigin(typeof window !== "undefined" ? window.location.origin : "");
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [dayRes, activeRes] = await Promise.all([
        fetch(`/api/time-punches?date=${encodeURIComponent(date)}`),
        fetch("/api/time-punches/active"),
      ]);
      const [dayList, activeList] = await Promise.all([parseJsonArray(dayRes), parseJsonArray(activeRes)]);
      setPunches(dayList);
      setActivePunches(activeList);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load punches");
      setPunches([]);
      setActivePunches([]);
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(() => {
      load();
    }, 30000);
    return () => clearInterval(id);
  }, [load]);

  async function stopSession(punchId: string) {
    setStoppingId(punchId);
    try {
      const res = await fetch(`/api/time-punches/${punchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const raw = await res.text();
      let errMsg = "Could not stop session";
      if (!res.ok) {
        try {
          const j = JSON.parse(raw) as { error?: string };
          if (j.error) errMsg = j.error;
        } catch {
          /* ignore */
        }
        toast.error(errMsg);
        return;
      }
      toast.success("Session stopped");
      load();
    } catch {
      toast.error("Failed to stop session");
    } finally {
      setStoppingId(null);
    }
  }

  async function deleteP(punchId: string) {
    if (!confirm("Delete this punch?")) return;
    try {
      const res = await fetch(`/api/time-punches/${punchId}`, { method: "DELETE" });
      if (!res.ok) {
        toast.error("Failed to delete punch");
        return;
      }
      toast.success("Punch deleted");
      load();
    } catch {
      toast.error("Failed to delete punch");
    }
  }

  const completedPunches = punches.filter((p) => p.endTime !== null);
  const totalMinutes = completedPunches.reduce((sum, p) => sum + (p.durationMinutes ?? 0), 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Punch Board</h1>
          <p className="text-sm text-gray-500 mt-1">
            Live view of who is clocked in from{" "}
            <strong className="text-gray-700">station QR codes</strong> — same data as{" "}
            <code className="text-xs bg-gray-100 px-1 rounded">/punch/[station]</code>.
          </p>
          <div className="flex flex-wrap gap-2 mt-3">
            <Link
              href="/admin/employees"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline"
            >
              Team Members
            </Link>
            <span className="text-gray-300">·</span>
            <Link
              href="/admin/stations"
              className="text-xs font-medium text-indigo-600 hover:text-indigo-800 underline-offset-2 hover:underline"
            >
              Work Stations &amp; QR
            </Link>
          </div>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 shrink-0"
        />
      </div>

      {/* Active now */}
      <div className="mb-6">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">On the floor right now</h2>
        {loading && activePunches.length === 0 ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : activePunches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/80 px-4 py-6 text-center text-sm text-gray-500">
            <p className="font-medium text-gray-700 mb-1">No active punches</p>
            <p className="text-xs text-gray-500 max-w-md mx-auto">
              Workers clock in by scanning a station QR (Admin → Work Stations &amp; QR). Their name appears here with a{" "}
              <strong>Stop</strong> button so you can end a session if they forgot, or they can stop from the tablet.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {activePunches.map((p) => (
              <div
                key={p.id}
                className="rounded-xl border border-green-200 bg-green-50 p-4 flex flex-col gap-3 shadow-sm"
              >
                <div className="flex items-start gap-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
                    style={{ backgroundColor: p.employee.color }}
                  >
                    {p.employee.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{p.employee.name}</p>
                    <p className="text-xs text-gray-600 truncate">
                      {p.station?.name ?? "No station"}
                      {p.project ? ` · ${p.project.jobNumber ?? p.project.name}` : ""}
                    </p>
                    {p.station?.slug && origin && (
                      <a
                        href={`${origin}/punch/${p.station.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-indigo-600 hover:underline mt-0.5 inline-block truncate max-w-full"
                      >
                        Open punch screen →
                      </a>
                    )}
                    <p className="text-xs text-green-700 font-mono mt-1" suppressHydrationWarning>
                      {formatDuration(null, p.startTime, null)}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => stopSession(p.id)}
                  disabled={stoppingId === p.id}
                  className="w-full rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold py-2.5 px-3 transition-colors disabled:opacity-60 shadow-sm"
                >
                  {stoppingId === p.id ? "Stopping…" : "Stop session"}
                </button>
                <p className="text-[10px] text-gray-500 leading-snug -mt-1">
                  Ends this punch so they can scan another station or go home. Same as{" "}
                  <strong>Stop — end session</strong> on the station tablet.
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Day summary */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-widest">
          {date === today() ? "Today" : date} — {completedPunches.length} punches completed
        </h2>
        {completedPunches.length > 0 && <span className="text-sm font-semibold text-gray-700">{totalHours}h total</span>}
      </div>

      {loading && punches.length === 0 ? (
        <p className="text-sm text-gray-400">Loading history…</p>
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
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                        style={{ backgroundColor: p.employee.color }}
                      >
                        {p.employee.name.charAt(0)}
                      </div>
                      <span className="font-medium text-gray-900">{p.employee.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {p.station ? (
                      <span>
                        {p.station.name}
                        {p.station.slug && (
                          <span className="block text-[10px] text-gray-400 font-mono">{p.station.slug}</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-gray-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600 max-w-[160px] truncate">
                    {p.project ? (
                      p.project.jobNumber ? `${p.project.jobNumber}` : p.project.name
                    ) : (
                      <span className="text-gray-300">General</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{formatTime(p.startTime)}</td>
                  <td className="px-4 py-3 text-gray-500 font-mono">{p.endTime ? formatTime(p.endTime) : "—"}</td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-700">
                    {formatDuration(p.durationMinutes, p.startTime, p.endTime)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => deleteP(p.id)}
                      className="text-xs text-gray-300 hover:text-red-500 transition-colors"
                      aria-label="Delete punch"
                    >
                      ✕
                    </button>
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

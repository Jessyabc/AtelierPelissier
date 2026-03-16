"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";

type Employee = { id: string; name: string; color: string; role: string; active: boolean };
type Project = { id: string; name: string; jobNumber: string | null };
type Station = { id: string; name: string; slug: string; location: string | null };
type ActivePunch = {
  id: string;
  employeeId: string;
  startTime: string;
  employee: { id: string; name: string; color: string };
  project: { id: string; name: string; jobNumber: string | null } | null;
  station: { id: string; name: string; slug: string } | null;
};

type Step = "select-employee" | "select-project" | "confirm-clockout";

function elapsed(startTime: string) {
  const diff = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}m ${s.toString().padStart(2, "0")}s`;
}

export default function PunchPage() {
  const params = useParams();
  const stationSlug = params.station as string;

  const [station, setStation] = useState<Station | null>(null);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [activeJobs, setActiveJobs] = useState<Project[]>([]);
  const [activePunch, setActivePunch] = useState<ActivePunch | null>(null);

  const [step, setStep] = useState<Step>("select-employee");
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);
  const [tick, setTick] = useState(0);

  // Tick elapsed timer
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const load = useCallback(async () => {
    const [stationsRes, empRes, projRes] = await Promise.all([
      fetch("/api/work-stations"),
      fetch("/api/employees"),
      fetch("/api/projects"),
    ]);
    const stations: Station[] = await stationsRes.json();
    const emps: Employee[] = await empRes.json();
    const projects: (Project & { isDraft: boolean; isDone: boolean })[] = await projRes.json();

    const found = stations.find((s) => s.slug === stationSlug) ?? null;
    setStation(found);
    setEmployees(emps.filter((e) => e.active));
    setActiveJobs(projects.filter((p) => !p.isDraft && !p.isDone));
  }, [stationSlug]);

  useEffect(() => { load(); }, [load]);

  async function checkActivePunch(employeeId: string) {
    const res = await fetch(`/api/time-punches/active?employeeId=${employeeId}`);
    const punches: ActivePunch[] = await res.json();
    return punches[0] ?? null;
  }

  async function handleSelectEmployee(emp: Employee) {
    setSelectedEmployee(emp);
    const existing = await checkActivePunch(emp.id);
    if (existing) {
      setActivePunch(existing);
      setStep("confirm-clockout");
    } else {
      setActivePunch(null);
      setStep("select-project");
    }
  }

  async function handleClockIn(project: Project | null) {
    if (!selectedEmployee || !station) return;
    setLoading(true);
    try {
      await fetch("/api/time-punches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          stationId: station.id,
          projectId: project?.id ?? null,
        }),
      });
      setMessage({ text: `Clocked in — ${selectedEmployee.name} @ ${station.name}${project ? ` · ${project.jobNumber ?? project.name}` : ""}`, type: "success" });
      reset();
    } catch {
      setMessage({ text: "Error — please try again", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  async function handleClockOut() {
    if (!activePunch) return;
    setLoading(true);
    try {
      await fetch(`/api/time-punches/${activePunch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const dur = Math.round((Date.now() - new Date(activePunch.startTime).getTime()) / 60000);
      const h = Math.floor(dur / 60);
      const m = dur % 60;
      const durStr = h > 0 ? `${h}h ${m}m` : `${m}m`;
      setMessage({ text: `Clocked out — ${activePunch.employee.name} · ${durStr} logged`, type: "success" });
      reset();
    } catch {
      setMessage({ text: "Error — please try again", type: "error" });
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep("select-employee");
    setSelectedEmployee(null);
    setSelectedProject(null);
    setActivePunch(null);
    setTimeout(() => setMessage(null), 4000);
  }

  const woodworkers = employees.filter((e) => e.role === "woodworker");
  const others = employees.filter((e) => e.role !== "woodworker");
  const orderedEmployees = [...woodworkers, ...others];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-white/10">
        <p className="text-xs text-white/40 uppercase tracking-widest mb-1">Atelier Pelissier</p>
        <h1 className="text-xl font-bold">{station?.name ?? stationSlug}</h1>
        {station?.location && <p className="text-sm text-white/50 mt-0.5">{station.location}</p>}
      </div>

      {/* Message toast */}
      {message && (
        <div className={`mx-4 mt-4 rounded-xl px-4 py-3 text-sm font-medium ${message.type === "success" ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-red-500/20 text-red-300 border border-red-500/30"}`}>
          {message.text}
        </div>
      )}

      <div className="flex-1 px-4 py-5">

        {/* STEP 1: Select employee */}
        {step === "select-employee" && (
          <div>
            <p className="text-sm text-white/50 mb-4">Who are you?</p>
            <div className="grid grid-cols-2 gap-3">
              {orderedEmployees.map((emp) => (
                <button
                  key={emp.id}
                  onClick={() => handleSelectEmployee(emp)}
                  className="rounded-2xl py-5 px-4 text-center font-semibold text-base active:scale-95 transition-transform"
                  style={{ backgroundColor: emp.color + "33", borderWidth: 2, borderColor: emp.color, color: emp.color }}
                >
                  {emp.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* STEP 2: Clock-out confirmation (already punched in) */}
        {step === "confirm-clockout" && activePunch && selectedEmployee && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl bg-white/5 border border-white/10 p-5">
              <p className="text-xs text-white/40 uppercase tracking-widest mb-2">Currently clocked in</p>
              <p className="text-2xl font-bold" style={{ color: selectedEmployee.color }}>{selectedEmployee.name}</p>
              {activePunch.project && (
                <p className="text-sm text-white/60 mt-1">
                  {activePunch.project.jobNumber ? `${activePunch.project.jobNumber} — ` : ""}{activePunch.project.name}
                </p>
              )}
              {activePunch.station && (
                <p className="text-xs text-white/40 mt-1">{activePunch.station.name}</p>
              )}
              <p className="text-3xl font-mono font-bold mt-3 text-white">
                {elapsed(activePunch.startTime)}
                <span className="text-sm text-white/30 ml-2 font-sans font-normal" suppressHydrationWarning>{tick >= 0 ? "" : ""}</span>
              </p>
            </div>

            <button
              onClick={handleClockOut}
              disabled={loading}
              className="w-full rounded-2xl py-5 bg-red-500 hover:bg-red-400 active:scale-95 transition-all font-bold text-xl disabled:opacity-50"
            >
              {loading ? "..." : "⏹ Clock Out"}
            </button>

            <button
              onClick={() => { setStep("select-project"); setActivePunch(null); }}
              className="w-full rounded-2xl py-3 bg-white/10 hover:bg-white/20 active:scale-95 transition-all text-sm text-white/60"
            >
              Switch job instead
            </button>

            <button
              onClick={reset}
              className="w-full rounded-2xl py-3 bg-transparent text-white/30 text-sm active:scale-95"
            >
              Cancel
            </button>
          </div>
        )}

        {/* STEP 3: Select project to clock into */}
        {step === "select-project" && selectedEmployee && (
          <div>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: selectedEmployee.color }} />
              <span className="font-semibold">{selectedEmployee.name}</span>
              <button onClick={reset} className="ml-auto text-white/30 text-sm">✕ Cancel</button>
            </div>
            <p className="text-sm text-white/50 mb-3">Which job?</p>

            <div className="flex flex-col gap-2">
              {activeJobs.map((proj) => (
                <button
                  key={proj.id}
                  onClick={() => handleClockIn(proj)}
                  disabled={loading}
                  className="w-full rounded-xl py-4 px-4 text-left bg-white/5 border border-white/10 hover:bg-white/10 active:scale-[0.98] transition-all disabled:opacity-50"
                >
                  <p className="font-semibold text-white">{proj.jobNumber && <span className="text-white/50 font-normal">{proj.jobNumber} — </span>}{proj.name}</p>
                </button>
              ))}

              <button
                onClick={() => handleClockIn(null)}
                disabled={loading}
                className="w-full rounded-xl py-4 px-4 text-left bg-transparent border border-white/10 hover:bg-white/5 active:scale-[0.98] transition-all text-white/40 text-sm disabled:opacity-50"
              >
                No specific job / General work
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

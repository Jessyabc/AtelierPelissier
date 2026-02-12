"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { parseServiceCallTypesJson } from "@/lib/serviceCallTypes";

type CalendarEvent = {
  id: string;
  type?: "service_call" | "manual";
  projectId?: string;
  serviceCallNumber?: string | null;
  serviceCallType?: string | null;
  serviceDate: string;
  timeOfArrival?: string | null;
  clientName: string;
  jobNumber?: string | null;
  projectName?: string;
  address?: string | null;
};

type DayEvent = {
  id: string;
  serviceCallId?: string;
  type: "service_call" | "manual";
  time: string;
  sortOrder: number;
  title: string;
  address: string | null;
  jobNumber?: string | null;
  clientName?: string;
  projectId?: string;
  notes?: string | null;
};

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatTime(iso: string | null): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleTimeString("en-CA", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

function getDaysInMonth(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startPad = first.getDay();
  const days: Date[] = [];
  for (let i = 0; i < startPad; i++) days.push(new Date(0));
  for (let d = 1; d <= last.getDate(); d++) days.push(new Date(year, month, d));
  return days;
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function CalendarContent() {
  const searchParams = useSearchParams();
  const [now] = useState(() => new Date());
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const initialYear = yearParam ? parseInt(yearParam, 10) : now.getFullYear();
  const initialMonth = monthParam ? Math.min(11, Math.max(0, parseInt(monthParam, 10) - 1)) : now.getMonth();
  const [year, setYear] = useState(initialYear);
  const [month, setMonth] = useState(isNaN(initialMonth) ? now.getMonth() : initialMonth);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  // Day view
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dayEvents, setDayEvents] = useState<DayEvent[]>([]);
  const [dayLoading, setDayLoading] = useState(false);
  const [addManualTitle, setAddManualTitle] = useState("");
  const [addManualTime, setAddManualTime] = useState("");
  const [addManualAddress, setAddManualAddress] = useState("");
  const [addManualNotes, setAddManualNotes] = useState("");
  const [addingManual, setAddingManual] = useState(false);
  const [serviceCalls, setServiceCalls] = useState<{ id: string; projectId: string; jobNumber: string | null; serviceCallNumber: string | null; clientName: string; serviceDate: string | null }[]>([]);
  const [addExistingScId, setAddExistingScId] = useState("");
  const [addingExisting, setAddingExisting] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?year=${year}&month=${month + 1}`);
      const data = await res.json();
      setEvents(data.events ?? []);
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [year, month]);

  const fetchDay = useCallback(async (dateKey: string) => {
    setDayLoading(true);
    try {
      const res = await fetch(`/api/day-plan?date=${dateKey}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed");
      setDayEvents(data.events ?? []);
    } catch (e) {
      setDayEvents([]);
      toast.error(e instanceof Error ? e.message : "Failed to load day");
    } finally {
      setDayLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  useEffect(() => {
    if (yearParam && monthParam) {
      const y = parseInt(yearParam, 10);
      const m = Math.min(11, Math.max(0, parseInt(monthParam, 10) - 1));
      if (!isNaN(y) && !isNaN(m)) {
        setYear(y);
        setMonth(m);
      }
    }
  }, [yearParam, monthParam]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") fetchEvents();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [fetchEvents]);

  useEffect(() => {
    if (selectedDate) fetchDay(selectedDate);
  }, [selectedDate, fetchDay]);

  const eventsByDate = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    const key = ev.serviceDate.slice(0, 10);
    if (!acc[key]) acc[key] = [];
    acc[key].push(ev);
    return acc;
  }, {});

  const openDay = (dateKey: string) => {
    setSelectedDate(dateKey);
  };

  const closeDay = () => {
    setSelectedDate(null);
    setAddManualTitle("");
    setAddManualTime("");
    setAddManualAddress("");
    setAddManualNotes("");
    setAddExistingScId("");
  };

  // Load service calls when day opens (for "add existing" picker)
  useEffect(() => {
    if (selectedDate) {
      fetch("/api/service-calls")
        .then((r) => r.json())
        .then((data) => setServiceCalls(Array.isArray(data) ? data : []))
        .catch(() => setServiceCalls([]));
    }
  }, [selectedDate]);

  const addExistingServiceCall = async () => {
    if (!selectedDate || !addExistingScId) {
      toast.error("Select a service call");
      return;
    }
    const alreadyInPlan = dayEvents.some((e) => e.type === "service_call" && e.serviceCallId === addExistingScId);
    if (alreadyInPlan) {
      toast.error("That service call is already in this day");
      return;
    }
    setAddingExisting(true);
    try {
      const res = await fetch("/api/day-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate, type: "service_call", serviceCallId: addExistingScId }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Service call added to day");
      setAddExistingScId("");
      await fetchDay(selectedDate);
      await fetchEvents();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddingExisting(false);
    }
  };

  const addManualEvent = async () => {
    if (!selectedDate || !addManualTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setAddingManual(true);
    try {
      const res = await fetch("/api/day-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: selectedDate,
          type: "manual",
          title: addManualTitle.trim(),
          scheduledTime: addManualTime.trim() || null,
          address: addManualAddress.trim() || null,
          notes: addManualNotes.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Event added");
      setAddManualTitle("");
      setAddManualTime("");
      setAddManualAddress("");
      setAddManualNotes("");
      await fetchDay(selectedDate);
      await fetchEvents();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAddingManual(false);
    }
  };

  const moveEvent = async (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= dayEvents.length) return;
    const ev = dayEvents[index];
    const swapEv = dayEvents[newIndex];

    try {
      await fetch(`/api/day-plan/${ev.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: swapEv.sortOrder }),
      });
      await fetch(`/api/day-plan/${swapEv.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sortOrder: ev.sortOrder }),
      });
      await fetchDay(selectedDate!);
    } catch {
      toast.error("Failed to reorder");
    }
  };

  const removeFromDay = async (id: string) => {
    try {
      const res = await fetch(`/api/day-plan/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      toast.success("Removed from day");
      await fetchDay(selectedDate!);
      await fetchEvents();
    } catch {
      toast.error("Failed to remove");
    }
  };

  const printDay = () => {
    const printEl = document.getElementById("day-print");
    if (!printEl) return;
    const clone = printEl.cloneNode(true) as HTMLElement;
    clone.id = "day-print-clone";
    clone.style.display = "none";
    document.body.appendChild(clone);
    document.body.classList.add("printing-day");
    window.print();
    const cleanup = () => {
      document.body.classList.remove("printing-day");
      document.body.removeChild(clone);
      window.removeEventListener("afterprint", cleanup);
    };
    window.addEventListener("afterprint", cleanup);
    setTimeout(cleanup, 1000); // Fallback if afterprint doesn't fire
  };

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((y) => y - 1);
    } else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((y) => y + 1);
    } else setMonth((m) => m + 1);
  };

  const goToday = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth());
  };

  const days = getDaysInMonth(year, month);
  const todayKey = toDateKey(now);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-600">
          Plan your days: service calls, manual events. Click a day to view, add events, reorder, and print the route.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-2">
          <button type="button" onClick={prevMonth} className="neo-btn px-3 py-1.5 text-sm font-medium">←</button>
          <h2 className="min-w-[200px] text-center text-lg font-medium text-gray-800">{MONTHS[month]} {year}</h2>
          <button type="button" onClick={nextMonth} className="neo-btn px-3 py-1.5 text-sm font-medium">→</button>
        </div>
        <button type="button" onClick={goToday} className="neo-btn px-3 py-1.5 text-sm font-medium">Today</button>
        <button type="button" onClick={() => fetchEvents()} disabled={loading} className="neo-btn px-3 py-1.5 text-sm font-medium disabled:opacity-50" title="Refresh">Refresh</button>
        <Link href="/service-calls" className="rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900">New service call</Link>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">Loading…</div>
      ) : (
        <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-200 bg-gray-50">
            {WEEKDAYS.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-medium text-gray-600">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7" style={{ gridTemplateRows: `repeat(${Math.ceil(days.length / 7)}, minmax(100px, 1fr))` }}>
            {days.map((d, i) => {
              const isPad = d.getTime() === 0;
              const dateKey = isPad ? "" : toDateKey(d);
              const dayEventsCount = dateKey ? (eventsByDate[dateKey]?.length ?? 0) : 0;
              const isToday = dateKey === todayKey;

              return (
                <div
                  key={i}
                  onClick={!isPad ? () => openDay(dateKey) : undefined}
                  className={`min-h-[100px] border-b border-r border-gray-100 p-2 cursor-pointer ${isPad ? "cursor-default" : "hover:bg-gray-50"} ${isPad ? "bg-gray-50/50" : "bg-white"} ${isToday ? "bg-blue-50/50" : ""}`}
                >
                  {!isPad && (
                    <>
                      <div className={`mb-2 text-sm font-medium ${isToday ? "text-blue-700" : "text-gray-700"}`}>{d.getDate()}</div>
                      <div className="space-y-1">
                        {(eventsByDate[dateKey] ?? []).map((ev) => {
                          const types = parseServiceCallTypesJson(ev.serviceCallType ?? null);
                          const typeLabel = types.length ? types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "";
                          const content = (
                            <>
                              <span className="font-medium text-gray-900">{ev.jobNumber || ev.serviceCallNumber || ev.clientName || "—"}</span>
                              {ev.timeOfArrival && <span className="ml-1 text-gray-500">{formatTime(ev.timeOfArrival)}</span>}
                              {typeLabel && <span className="block truncate text-gray-600">{typeLabel}</span>}
                              <span className="block truncate text-gray-500">{ev.clientName}</span>
                            </>
                          );
                          if (ev.type === "manual" || !ev.projectId) {
                            return <div key={ev.id} className="block neo-card-accent px-2 py-1.5 text-xs rounded-lg">{content}</div>;
                          }
                          return (
                            <Link key={ev.id} href={`/projects/${ev.projectId}`} onClick={(e) => e.stopPropagation()} className="block neo-card px-2 py-1.5 text-xs hover:shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)]">
                              {content}
                            </Link>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!loading && events.length === 0 && (
        <p className="text-center text-sm text-gray-500">No events this month. Click a day to add one.</p>
      )}

      {/* Day view modal */}
      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeDay}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="sticky top-0 border-b border-gray-200 bg-white p-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">
                {selectedDate} — Day schedule
              </h2>
              <div className="flex gap-2">
                <button type="button" onClick={printDay} disabled={dayEvents.length === 0} className="neo-btn px-3 py-1.5 text-sm font-medium disabled:opacity-50">
                  Print day
                </button>
                <button type="button" onClick={closeDay} className="neo-btn px-3 py-1.5 text-sm font-medium">
                  Close
                </button>
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Add existing service call */}
              <div className="neo-panel-inset p-4 rounded-xl">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Add existing service call</h3>
                <div className="flex flex-wrap gap-2">
                  <select
                    value={addExistingScId}
                    onChange={(e) => setAddExistingScId(e.target.value)}
                    className="neo-input min-w-[200px] px-3 py-2 text-sm"
                  >
                    <option value="">— Select —</option>
                    {serviceCalls
                      .filter((sc) => !dayEvents.some((e) => e.serviceCallId === sc.id))
                      .map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.serviceCallNumber || sc.jobNumber || "—"} · {sc.clientName} {sc.serviceDate ? `(${sc.serviceDate.slice(0, 10)})` : ""}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={addExistingServiceCall}
                    disabled={addingExisting || !addExistingScId}
                    className="rounded bg-gray-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
                  >
                    {addingExisting ? "Adding…" : "Add"}
                  </button>
                </div>
              </div>

              {/* Add new event */}
              <div className="neo-panel-inset p-4 rounded-xl">
                <h3 className="mb-3 text-sm font-semibold text-gray-800">Add new event</h3>
                <div className="grid gap-2 sm:grid-cols-2">
                  <input type="text" placeholder="Title *" value={addManualTitle} onChange={(e) => setAddManualTitle(e.target.value)} className="neo-input px-3 py-2 text-sm" />
                  <input type="time" placeholder="Time" value={addManualTime} onChange={(e) => setAddManualTime(e.target.value)} className="neo-input px-3 py-2 text-sm" />
                  <input type="text" placeholder="Address / destination" value={addManualAddress} onChange={(e) => setAddManualAddress(e.target.value)} className="sm:col-span-2 neo-input px-3 py-2 text-sm" />
                  <input type="text" placeholder="Notes" value={addManualNotes} onChange={(e) => setAddManualNotes(e.target.value)} className="sm:col-span-2 neo-input px-3 py-2 text-sm" />
                </div>
                <button type="button" onClick={addManualEvent} disabled={addingManual || !addManualTitle.trim()} className="mt-2 rounded bg-gray-800 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-900 disabled:opacity-50">
                  {addingManual ? "Adding…" : "Add"}
                </button>
              </div>

              {/* Day events list */}
              {dayLoading ? (
                <p className="text-sm text-gray-500">Loading…</p>
              ) : dayEvents.length === 0 ? (
                <p className="text-sm text-gray-500">No events. Add one above.</p>
              ) : (
                <ul className="space-y-2">
                  {dayEvents.map((ev, idx) => (
                    <li key={ev.id} className="flex items-center gap-2 neo-card p-3">
                      <span className="w-12 shrink-0 text-xs text-gray-500">{ev.time || "—"}</span>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-gray-900">{ev.title}</span>
                        {ev.address && <span className="block text-sm text-gray-600">{ev.address}</span>}
                        {ev.clientName && ev.type === "service_call" && <span className="block text-xs text-gray-500">{ev.clientName}</span>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button type="button" onClick={() => moveEvent(idx, "up")} disabled={idx === 0} className="rounded border px-1.5 py-0.5 text-xs disabled:opacity-40" title="Move up">↑</button>
                        <button type="button" onClick={() => moveEvent(idx, "down")} disabled={idx === dayEvents.length - 1} className="rounded border px-1.5 py-0.5 text-xs disabled:opacity-40" title="Move down">↓</button>
                        <button type="button" onClick={() => removeFromDay(ev.id)} className="rounded border border-red-200 px-1.5 py-0.5 text-xs text-red-700" title="Remove from day">✕</button>
                        {ev.type === "service_call" && ev.projectId && (
                          <Link href={`/projects/${ev.projectId}`} className="ml-1 rounded border px-2 py-1 text-xs hover:bg-gray-50">Open</Link>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Printable day schedule — hidden, shown when printing */}
      {selectedDate && (
        <div id="day-print" className="hidden print:block">
          <div className="p-6">
            <h1 className="text-lg font-bold text-gray-900">Daily schedule — {selectedDate}</h1>
            <p className="text-sm text-gray-500 mb-4">Atelier Pelissier — Route & destinations</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-300">
                  <th className="py-2 text-left font-semibold">#</th>
                  <th className="py-2 text-left font-semibold">Time</th>
                  <th className="py-2 text-left font-semibold">Destination</th>
                  <th className="py-2 text-left font-semibold">Address / notes</th>
                </tr>
              </thead>
              <tbody>
                {dayEvents.map((ev, i) => (
                  <tr key={ev.id} className="border-b border-gray-100">
                    <td className="py-2">{i + 1}</td>
                    <td className="py-2">{ev.time || "—"}</td>
                    <td className="py-2">{ev.title}</td>
                    <td className="py-2">{ev.address || ev.notes || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-6 text-xs text-gray-500">Printed {new Date().toLocaleString("en-CA")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl py-12 text-center text-gray-500">Loading calendar…</div>}>
      <CalendarContent />
    </Suspense>
  );
}

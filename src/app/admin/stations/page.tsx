"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import QRCode from "qrcode";
import toast from "react-hot-toast";

type Station = { id: string; name: string; slug: string; location: string | null; active: boolean; sortOrder: number };

const EMPTY_FORM = { name: "", location: "", sortOrder: 0 };

export default function StationsPage() {
  const [stations, setStations] = useState<Station[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [qrDataUrls, setQrDataUrls] = useState<Record<string, string>>({});
  const [baseUrl, setBaseUrl] = useState("");
  const printRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/work-stations");
    const data: Station[] = await res.json();
    setStations(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    setBaseUrl(window.location.origin);
    load();
  }, [load]);

  useEffect(() => {
    if (!baseUrl || stations.length === 0) return;
    stations.forEach((s) => {
      const url = `${baseUrl}/punch/${s.slug}`;
      QRCode.toDataURL(url, { width: 256, margin: 2, color: { dark: "#111827", light: "#ffffff" } })
        .then((dataUrl) => setQrDataUrls((prev) => ({ ...prev, [s.id]: dataUrl })));
    });
  }, [stations, baseUrl]);

  function startEdit(s: Station) {
    setForm({ name: s.name, location: s.location ?? "", sortOrder: s.sortOrder });
    setEditingId(s.id);
    setShowForm(true);
  }

  function startNew() {
    setForm({ ...EMPTY_FORM, sortOrder: stations.length });
    setEditingId(null);
    setShowForm(true);
  }

  async function handleSave() {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = editingId
        ? await fetch(`/api/work-stations/${editingId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) })
        : await fetch("/api/work-stations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("Failed");
      toast.success(editingId ? "Station updated" : "Station added");
      setShowForm(false);
      setEditingId(null);
      setForm(EMPTY_FORM);
      load();
    } catch {
      toast.error("Failed to save station");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(s: Station) {
    try {
      await fetch(`/api/work-stations/${s.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: !s.active }) });
      toast.success(s.active ? `${s.name} disabled` : `${s.name} enabled`);
      load();
    } catch {
      toast.error("Failed to update station");
    }
  }

  function printAllQR() {
    const win = window.open("", "_blank");
    if (!win) return;
    const cards = stations
      .filter((s) => s.active && qrDataUrls[s.id])
      .map(
        (s) => `
        <div style="display:inline-block;margin:16px;padding:20px;border:2px solid #e5e7eb;border-radius:12px;text-align:center;font-family:sans-serif;width:220px;vertical-align:top;">
          <img src="${qrDataUrls[s.id]}" width="180" height="180" style="display:block;margin:0 auto 12px;"/>
          <p style="font-size:18px;font-weight:700;color:#111827;margin:0 0 4px;">${s.name}</p>
          ${s.location ? `<p style="font-size:12px;color:#6b7280;margin:0;">${s.location}</p>` : ""}
          <p style="font-size:10px;color:#9ca3af;margin:8px 0 0;word-break:break-all;">${baseUrl}/punch/${s.slug}</p>
        </div>`
      )
      .join("");
    win.document.write(`<html><body style="background:#fff;padding:20px;">${cards}</body></html>`);
    win.document.close();
    win.print();
  }

  return (
    <div className="max-w-2xl mx-auto py-8">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Work Stations</h1>
          <p className="text-sm text-gray-500 mt-1">Each station gets a QR code workers scan to punch in</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={printAllQR}
            className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          >
            🖨 Print all QR codes
          </button>
          <button
            onClick={startNew}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
          >
            + Add station
          </button>
        </div>
      </div>

      {/* Add / Edit form */}
      {showForm && (
        <div className="my-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">{editingId ? "Edit station" : "New station"}</h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="col-span-2">
              <label className="block text-xs text-gray-500 mb-1">Station name *</label>
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Scie table, Plaqueuse de chants"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Location / area</label>
              <input
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="e.g. Atelier principal"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Sort order</label>
              <input
                type="number"
                value={form.sortOrder}
                onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
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
        <p className="text-sm text-gray-400 mt-6">Loading...</p>
      ) : stations.length === 0 ? (
        <div className="mt-8 rounded-xl border border-dashed border-gray-200 p-8 text-center">
          <p className="text-sm text-gray-400">No stations yet. Add your first work station above.</p>
        </div>
      ) : (
        <div ref={printRef} className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {stations.map((s) => (
            <div key={s.id} className={`rounded-xl border bg-white p-4 ${s.active ? "border-gray-200" : "border-gray-100 opacity-60"}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{s.name}</p>
                  {s.location && <p className="text-xs text-gray-400 mt-0.5">{s.location}</p>}
                  <p className="text-xs text-gray-300 mt-1 font-mono">/punch/{s.slug}</p>
                </div>
                <div className="flex gap-2 text-xs">
                  <button onClick={() => startEdit(s)} className="text-indigo-600 hover:text-indigo-800 font-medium">Edit</button>
                  <button onClick={() => toggleActive(s)} className="text-gray-400 hover:text-gray-600">{s.active ? "Disable" : "Enable"}</button>
                </div>
              </div>
              {qrDataUrls[s.id] ? (
                <div className="flex flex-col items-center gap-2">
                  <img src={qrDataUrls[s.id]} alt={`QR for ${s.name}`} className="w-32 h-32 rounded-lg" />
                  <a
                    href={`${baseUrl}/punch/${s.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-indigo-600 hover:text-indigo-800"
                  >
                    Open punch page ↗
                  </a>
                </div>
              ) : (
                <div className="w-32 h-32 rounded-lg bg-gray-50 flex items-center justify-center text-xs text-gray-300">Generating...</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

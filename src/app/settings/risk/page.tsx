"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";

type RiskSettings = {
  id: string;
  targetMargin: number;
  warningMargin: number;
  highRiskMargin: number;
  criticalMargin: number;
  wasteFactor: number;
  inventoryShortageHigh: number;
} | null;

export default function RiskSettingsPage() {
  const [settings, setSettings] = useState<RiskSettings>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [targetMargin, setTargetMargin] = useState(0.25);
  const [warningMargin, setWarningMargin] = useState(0.25);
  const [highRiskMargin, setHighRiskMargin] = useState(0.18);
  const [criticalMargin, setCriticalMargin] = useState(0.12);
  const [wasteFactor, setWasteFactor] = useState(1.15);
  const [inventoryShortageHigh, setInventoryShortageHigh] = useState(0.2);

  useEffect(() => {
    fetch("/api/risk-settings")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setSettings(data);
          setTargetMargin(data.targetMargin);
          setWarningMargin(data.warningMargin);
          setHighRiskMargin(data.highRiskMargin);
          setCriticalMargin(data.criticalMargin);
          setWasteFactor(data.wasteFactor);
          setInventoryShortageHigh(data.inventoryShortageHigh);
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/risk-settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetMargin,
          warningMargin,
          highRiskMargin,
          criticalMargin,
          wasteFactor,
          inventoryShortageHigh,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Failed to save");
      setSettings(data);
      toast.success("Risk settings saved. Recalculating all projects…");
    } catch {
      toast.error("Failed to save risk settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="neumorphic-panel p-6">
        <p className="text-gray-600">Loading risk settings…</p>
      </div>
    );
  }

  const fields = [
    {
      label: "Target margin",
      value: targetMargin,
      set: setTargetMargin,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      label: "Warning margin",
      value: warningMargin,
      set: setWarningMargin,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      label: "High risk margin",
      value: highRiskMargin,
      set: setHighRiskMargin,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      label: "Critical margin",
      value: criticalMargin,
      set: setCriticalMargin,
      min: 0,
      max: 1,
      step: 0.01,
    },
    {
      label: "Waste factor",
      value: wasteFactor,
      set: setWasteFactor,
      min: 1,
      max: 2,
      step: 0.05,
    },
    {
      label: "Inventory shortage (high threshold)",
      value: inventoryShortageHigh,
      set: setInventoryShortageHigh,
      min: 0,
      max: 1,
      step: 0.05,
    },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Risk settings</h1>
        <p className="mt-1 text-sm text-gray-500">
          Global thresholds for deviation detection. Changes trigger recalculation across all
          projects.
        </p>
      </div>

      <div className="neumorphic-panel space-y-6 p-6">
        <h2 className="text-lg font-medium text-gray-800">Global risk settings</h2>
        {fields.map((f) => (
          <div key={f.label} className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="w-56 text-sm font-medium text-gray-700">{f.label}</label>
            <div className="flex flex-1 items-center gap-3">
              <input
                type="range"
                min={f.min}
                max={f.max}
                step={f.step}
                value={f.value}
                onChange={(e) => f.set(parseFloat(e.target.value))}
                className="h-2 flex-1"
              />
              <input
                type="number"
                min={f.min}
                max={f.max}
                step={f.step}
                value={f.value}
                onChange={(e) => f.set(parseFloat(e.target.value) || 0)}
                className="neo-input w-24 px-3 py-1.5 text-sm"
              />
            </div>
          </div>
        ))}
        <div className="pt-4">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="neo-btn-primary px-5 py-2.5 text-sm font-medium disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

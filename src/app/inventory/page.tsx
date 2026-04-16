"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

type InventoryItem = {
  id: string;
  materialCode: string;
  description: string;
  onHand: number;
  reservedQty: number;
  availableQty: number;
  incomingQty: number;
  minThreshold: number;
  reorderPoint: number;
  reorderQty: number;
  category: string;
  sectionId?: string | null;
  section?: { id: string; name: string } | null;
  locationNote?: string | null;
  belowReorder?: boolean;
  belowMin?: boolean;
};

type WarehouseSection = {
  id: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [sections, setSections] = useState<WarehouseSection[]>([]);
  const [sectionFilter, setSectionFilter] = useState<string>("all");
  const [showAddSection, setShowAddSection] = useState(false);
  const [newSectionName, setNewSectionName] = useState("");
  const [newSectionDescription, setNewSectionDescription] = useState("");
  const [addForm, setAddForm] = useState({
    materialCode: "",
    description: "",
    onHand: 0,
    unit: "sheets",
    minThreshold: 0,
    reorderPoint: 0,
    reorderQty: 0,
    category: "sheetGoods",
  });
  const [adding, setAdding] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const [invRes, secRes] = await Promise.all([
        fetch("/api/inventory"),
        fetch("/api/warehouse-sections"),
      ]);
      const [inv, sec] = await Promise.all([invRes.json(), secRes.json()]);
      setItems(Array.isArray(inv) ? inv : []);
      setSections(Array.isArray(sec) ? sec : []);
    } catch {
      setItems([]);
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const addItem = async () => {
    if (!addForm.materialCode.trim()) {
      toast.error("Material code is required");
      return;
    }
    setAdding(true);
    try {
      const res = await fetch("/api/inventory-items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialCode: addForm.materialCode.trim(),
          description: addForm.description.trim() || addForm.materialCode,
          onHand: addForm.onHand,
          stockQty: addForm.onHand,
          unit: addForm.unit,
          minThreshold: addForm.minThreshold,
          reorderPoint: addForm.reorderPoint,
          reorderQty: addForm.reorderQty,
          category: addForm.category,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      toast.success("Item added");
      setAddForm({
        materialCode: "",
        description: "",
        onHand: 0,
        unit: "sheets",
        minThreshold: 0,
        reorderPoint: 0,
        reorderQty: 0,
        category: "sheetGoods",
      });
      setShowAdd(false);
      await fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add");
    } finally {
      setAdding(false);
    }
  };

  const addSection = async () => {
    const name = newSectionName.trim();
    if (!name) {
      toast.error("Section name is required");
      return;
    }
    try {
      const res = await fetch("/api/warehouse-sections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description: newSectionDescription.trim() || null }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to create section");
      toast.success("Section created");
      setNewSectionName("");
      setNewSectionDescription("");
      setShowAddSection(false);
      await fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create section");
    }
  };

  const saveItemLocation = async (itemId: string, sectionId: string | null, locationNote: string) => {
    try {
      const res = await fetch(`/api/inventory-items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sectionId: sectionId || null,
          locationNote: locationNote.trim() || null,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Failed to update location");
      toast.success("Location saved");
      await fetchItems();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update location");
    }
  };

  const belowThreshold = items.filter((i) => i.belowMin ?? i.onHand < i.minThreshold);
  const belowReorder = items.filter((i) => i.belowReorder ?? (i.reorderPoint > 0 && i.onHand < i.reorderPoint));
  const filteredItems =
    sectionFilter === "all"
      ? items
      : sectionFilter === "__none"
        ? items.filter((i) => !(i.sectionId ?? i.section?.id))
        : items.filter((i) => (i.sectionId ?? i.section?.id ?? "") === sectionFilter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-gray-900">Inventory</h1>
        <div className="flex gap-2">
          <select
            value={sectionFilter}
            onChange={(e) => setSectionFilter(e.target.value)}
            className="neo-input px-3 py-2 text-sm"
            aria-label="Filter by warehouse section"
          >
            <option value="all">All sections</option>
            <option value="__none">Unassigned</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={fetchItems}
            disabled={loading}
            className="neo-btn px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={() => setShowAddSection(true)}
            className="neo-btn px-4 py-2 text-sm font-medium"
          >
            Add section
          </button>
          <button
            type="button"
            onClick={() => setShowAdd(true)}
            className="neo-btn-primary inline-block px-4 py-2 text-sm font-medium"
          >
            Add item
          </button>
        </div>
      </div>

      {loading ? (
        <p className="py-8 text-center text-gray-500">Loading…</p>
      ) : (
        <>
          {(belowThreshold.length > 0 || belowReorder.length > 0) && (
            <section className="neo-card p-4">
              <h2 className="mb-3 text-sm font-semibold text-gray-800">Alerts</h2>
              {belowThreshold.length > 0 && (
                <p className="text-sm text-amber-700">
                  Below min threshold: {belowThreshold.map((i) => i.materialCode).join(", ")}
                </p>
              )}
              {belowReorder.length > 0 && (
                <p className="text-sm text-amber-700">
                  Below reorder point: {belowReorder.map((i) => i.materialCode).join(", ")}
                </p>
              )}
            </section>
          )}

          <section>
            <h2 className="mb-3 text-lg font-medium text-gray-800">Stock overview</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Code</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Description</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600">Location</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">On hand</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Reserved</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Available</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Incoming</th>
                    <th className="px-4 py-2 text-right text-xs font-medium text-gray-600">Reorder</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => (
                    <tr
                      key={item.id}
                      className={`border-b border-gray-100 hover:bg-gray-50/50 ${
                        item.belowMin ? "bg-amber-50/50" : ""
                      }`}
                    >
                      <td className="px-4 py-2 font-medium text-gray-900">{item.materialCode}</td>
                      <td className="px-4 py-2 text-sm text-gray-600">{item.description}</td>
                      <td className="px-4 py-2 text-sm text-gray-700">
                        <div className="flex flex-col gap-1">
                          <select
                            className="neo-input px-2 py-1 text-xs"
                            defaultValue={item.sectionId ?? item.section?.id ?? "__none"}
                            onChange={(e) => {
                              const next = e.target.value;
                              const sectionId = next === "__none" ? null : next;
                              const note = (document.getElementById(`loc-note-${item.id}`) as HTMLInputElement | null)?.value ?? "";
                              saveItemLocation(item.id, sectionId, note);
                            }}
                            aria-label={`Warehouse section for ${item.materialCode}`}
                          >
                            <option value="__none">Unassigned</option>
                            {sections.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.name}
                              </option>
                            ))}
                          </select>
                          <input
                            id={`loc-note-${item.id}`}
                            defaultValue={item.locationNote ?? ""}
                            placeholder="Aisle/Rack/Shelf (optional)"
                            className="neo-input px-2 py-1 text-xs"
                            onBlur={(e) => {
                              const sid = item.sectionId ?? item.section?.id ?? null;
                              saveItemLocation(item.id, sid, e.target.value);
                            }}
                          />
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right text-sm">{item.onHand.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">{item.reservedQty.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-sm font-medium">{item.availableQty.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-sm text-gray-600">{item.incomingQty.toFixed(1)}</td>
                      <td className="px-4 py-2 text-right text-sm">
                        {item.reorderPoint > 0 ? `@ ${item.reorderPoint}` : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredItems.length === 0 && !showAdd && (
              <p className="neo-card mt-4 p-6 text-center text-sm text-gray-500">
                No inventory items yet. Click Add item to create one.
              </p>
            )}

            {showAddSection && (
              <div className="neo-card mt-4 p-4">
                <h3 className="mb-3 text-sm font-semibold">Add warehouse section</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Section name * (e.g. Sheet goods)"
                    value={newSectionName}
                    onChange={(e) => setNewSectionName(e.target.value)}
                    className="neo-input px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newSectionDescription}
                    onChange={(e) => setNewSectionDescription(e.target.value)}
                    className="neo-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={addSection}
                    disabled={!newSectionName.trim()}
                    className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    Create section
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddSection(false)}
                    className="neo-btn px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {showAdd && (
              <div className="neo-card mt-4 p-4">
                <h3 className="mb-3 text-sm font-semibold">Add inventory item</h3>
                <div className="grid gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    placeholder="Material code *"
                    value={addForm.materialCode}
                    onChange={(e) => setAddForm((f) => ({ ...f, materialCode: e.target.value }))}
                    className="neo-input px-3 py-2 text-sm"
                  />
                  <input
                    type="text"
                    placeholder="Description"
                    value={addForm.description}
                    onChange={(e) => setAddForm((f) => ({ ...f, description: e.target.value }))}
                    className="neo-input px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="On hand"
                    value={addForm.onHand || ""}
                    onChange={(e) => setAddForm((f) => ({ ...f, onHand: Number(e.target.value) || 0 }))}
                    className="neo-input px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Min threshold"
                    value={addForm.minThreshold || ""}
                    onChange={(e) => setAddForm((f) => ({ ...f, minThreshold: Number(e.target.value) || 0 }))}
                    className="neo-input px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Reorder point"
                    value={addForm.reorderPoint || ""}
                    onChange={(e) => setAddForm((f) => ({ ...f, reorderPoint: Number(e.target.value) || 0 }))}
                    className="neo-input px-3 py-2 text-sm"
                  />
                  <input
                    type="number"
                    placeholder="Reorder qty"
                    value={addForm.reorderQty || ""}
                    onChange={(e) => setAddForm((f) => ({ ...f, reorderQty: Number(e.target.value) || 0 }))}
                    className="neo-input px-3 py-2 text-sm"
                  />
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={addItem}
                    disabled={adding || !addForm.materialCode.trim()}
                    className="neo-btn-primary px-4 py-2 text-sm disabled:opacity-50"
                  >
                    {adding ? "Adding…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAdd(false)}
                    className="neo-btn px-4 py-2 text-sm"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}

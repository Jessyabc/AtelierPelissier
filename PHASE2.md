# Phase 2 Implementation Spec: Inventory, Purchasing, and Costing

## Executive Summary

Phase 2 turns MaterialRequirements into operational actions:

- **Allocation** — reserve stock to projects (allocate/deallocate/consume)
- **Purchasing** — orders linked to suppliers and "why" (project/material requirement)
- **Costing** — estimate vs actual by category, mapped to vendor invoices
- **Settings** — global defaults + per-project overrides

**Phase 1 loop remains:** Write → recalculateProjectState(projectId) → MaterialRequirements + Deviations → Dashboard reads.

---

## 1. Data Model Additions/Changes

### A) Inventory

| Model | Changes | Notes |
|-------|---------|-------|
| **InventoryItem** | Add: `onHand`, `reorderPoint`, `reorderQty`, `defaultSheetFormatId?`, `costDefault`, `category`. Rename `stockQty`→`onHand` (or migrate). `uom` replaces `unit`. | sku/materialCode unique; category: sheetGoods, hardware, finish, etc. |
| **StockMovement** | Add types: `deallocate`, `consume`, `return`, `adjust`. Add `orderLineId?`. | `receive` increases onHand; `allocate`/`consume` increase reserved; `deallocate`/`return` decrease reserved |

**Reserved/Available (computed):**

- `reservedQty` = sum(StockMovement.qty) where type in (allocate, consume) − sum(deallocate, return) per inventoryItem
- `availableQty` = onHand − reservedQty (+ incoming from open orders, optional)

### B) Purchasing

| Model | Purpose |
|-------|---------|
| **Supplier** | id, name, contactInfo, notes. Replaces/supplements string "supplier" on Order. |
| **SupplierCatalogItem** | supplierId, supplierSku, inventoryItemId, unitCost, leadTimeDays?, sheetFormatOverrideId? |
| **Order** | supplierId, status (draft\|placed\|partial\|received\|cancelled), expectedDeliveryDate? |
| **OrderLine** | orderId, inventoryItemId?, materialCode (for non-catalog), qtyOrdered, qtyReceived, unitCost, projectId? |

OrderLines link to projectId for "why did we order this?"

### C) Costing / Invoices

| Model | Purpose |
|-------|---------|
| **VendorInvoice** | supplierId, invoiceNumber, invoiceDate, fileUrl? |
| **VendorInvoiceLine** | invoiceId, descriptionRaw, qty, unitCost, mappedInventoryItemId?, mappedProjectId?, mappedCategory |
| **CostLine** (extend) | Add `vendorInvoiceLineId?`; keep `kind` (estimate\|actual), `category` |

### D) Settings

| Model | Purpose |
|-------|---------|
| **GlobalSettings** (singleton) | defaultMarkup, targetMarginPct, warningMarginPct, highRiskMarginPct, criticalMarginPct, wasteFactor, taxEnabledDefault, defaultSheetFormatId |
| **ProjectSettings** (extend) | Add nullable overrides for above + taxEnabled override |

### E) SheetFormat (exists)

Already present. Used by: ProjectSettings, InventoryItem (defaultSheetFormatId), SupplierCatalogItem (override).

---

## 2. Core Flows

### Receiving Flow

1. User opens Order, clicks "Receive" on OrderLine.
2. POST /api/orders/[id]/lines/[lineId]/receive with qtyReceived.
3. Create StockMovement(type=receive, qty, orderLineId).
4. Increment InventoryItem.onHand (or update from movement sum).
5. Fire recalculateInventoryRisk for projects linked to that material.

### Allocation Flow

1. User allocates stock to project from Inventory UI.
2. POST /api/stock-movements { type: "allocate", inventoryItemId, projectId, qty }.
3. recalculateMaterialRequirements(projectId) updates allocatedQty.
4. recalculateInventoryRisk(projectId).

### Purchasing Flow

1. User creates Order (draft), adds OrderLines (materialCode/projectId).
2. Order placed → status = placed.
3. When received → StockMovement(receive) + onHand update.

### Invoice Mapping Flow

1. Create VendorInvoice + VendorInvoiceLines (manual entry).
2. Map each line to: mappedProjectId, mappedCategory, mappedInventoryItemId?.
3. System creates CostLine(kind=actual, category, amount, vendorInvoiceLineId).
4. Enables estimate vs actual comparison by category.

---

## 3. API Routes (CRUD Minimal)

| Route | Methods | Purpose |
|-------|---------|---------|
| /api/inventory-items | GET, POST | List, create |
| /api/inventory-items/[id] | GET, PATCH | Get, update |
| /api/stock-movements | POST | Create movement (allocate, receive, etc.) |
| /api/suppliers | GET, POST | List, create |
| /api/suppliers/[id] | GET, PATCH | Get, update |
| /api/orders | GET, POST | List, create |
| /api/orders/[id] | GET, PATCH | Get, update status |
| /api/orders/[id]/lines | POST | Add line |
| /api/orders/[id]/lines/[lineId] | PATCH | Update (receive qty) |
| /api/vendor-invoices | GET, POST | List, create |
| /api/vendor-invoices/[id] | GET, PATCH | Get, update |
| /api/vendor-invoices/[id]/lines | POST | Add invoice line |
| /api/settings/global | GET, PATCH | GlobalSettings singleton |
| /api/settings/project/[projectId] | GET, PATCH | ProjectSettings overrides |

---

## 4. Recalc Engine Upgrades

Split into modules (already partially done):

| Module | Responsibility |
|--------|----------------|
| recalculateFinancialState | expectedCost, realCost, margin; creates margin_risk, cost_overrun |
| recalculateMaterialRequirements | PanelParts → requiredQty; StockMovement(allocate) → allocatedQty |
| **recalculateInventoryState** (new) | Compute reservedQty per item from StockMovement; availableQty = onHand − reserved |
| recalculateInventoryRisk | inventory_shortage when requiredQty > availableQty; uses resolved settings |
| recalculateOrderRisk | order_delay when need material but no order |

All thresholds from `getEffectiveRiskSettings` (global + project override). No hardcoded numbers.

---

## 5. Dashboard Surfaces (Phase 2)

| Page | Sections |
|------|----------|
| **/inventory** | List items; onHand/reserved/available; below reorder point; create item, stock movement |
| **/purchasing** | Open orders; late/partial; create order; receive against line |
| **/costing** | Invoice list; invoice line mapping; project estimate vs actual by category |

Filters (optional): supplier, category, materialCode, project status, date range.

---

## 6. Migration Notes + Seed Strategy

- **Migration:** Add new models; extend existing (CostLine, ProjectSettings, InventoryItem, StockMovement, Order, OrderLine). Use `onHand`; migrate `stockQty` → `onHand` if renaming.
- **Order.supplier:** Add supplierId; migrate string supplier to Supplier record or leave nullable.
- **Seed:** Create GlobalSettings row; default SheetFormat(s); sample Supplier/InventoryItem if desired.

---

## 7. Out-of-Scope (Phase 2)

- No automation/notifications
- No invoice PDF parsing (manual entry only)
- No external integrations
- No auth changes (internal-only; admin surfaces designed but not gated)

---

## 8. Implementation Status (Initial)

- [x] PHASE2.md spec
- [x] Schema extensions (Prisma)
- [x] recalculateInventoryState module
- [x] getEffectiveRiskSettings → GlobalSettings + ProjectSettings overrides
- [x] Inventory, Suppliers, Orders, VendorInvoices, Settings APIs
- [x] Stock movement receive flow (updates onHand)
- [x] Order line receive endpoint
- [x] /inventory, /purchasing, /costing pages (basic)

---

## Phase 1 Preservation

- Dashboard (/dashboard) remains read-only.
- recalculateProjectState remains fire-and-forget.
- Writes never block; recalc triggered after successful write.

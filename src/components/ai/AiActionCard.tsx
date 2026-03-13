"use client";

const actionLabels: Record<string, string> = {
  createOrder: "Create Purchase Order",
  addMaterial: "Add Material to Project",
  openEmail: "Open Email Draft",
  createProjectFromMonday: "Create Project from Monday.com",
  receiveInventory: "Receive Stock into Inventory",
  createInventoryItem: "Create New Inventory Item",
  updateProjectStatus: "Update Project Status",
  receiveOrder: "Receive Order",
};

export function AiActionCard({
  action,
  onApprove,
  onReject,
  isExecuting = false,
}: {
  action: { action: string; [key: string]: unknown };
  onApprove: () => void;
  onReject: () => void;
  isExecuting?: boolean;
}) {
  const label = actionLabels[action.action] ?? action.action;

  return (
    <div className="ml-2 mt-2 neo-card p-3 max-w-[85%]">
      <div className="text-xs font-semibold text-[var(--foreground)] mb-1.5">
        Proposed Action: {label}
      </div>

      <div className="text-xs text-[var(--foreground-muted)] space-y-0.5 mb-3">
        {action.action === "createOrder" && (
          <>
            <div>Type: {action.orderType === "reserve" ? "Reservation" : "Order"}</div>
            {action.projectRef && <div>Ref: {String(action.projectRef)}</div>}
            {Array.isArray(action.items) && (
              <div>
                Items: {(action.items as { materialCode: string; quantity: number }[]).map(
                  (i) => `${i.quantity}x ${i.materialCode}`
                ).join(", ")}
              </div>
            )}
          </>
        )}

        {action.action === "addMaterial" && (
          <>
            <div>Material: {String(action.materialCode)}</div>
            <div>Quantity: {String(action.quantity)}</div>
            <div>Project: {String(action.projectId)}</div>
          </>
        )}

        {action.action === "openEmail" && (
          <div>Supplier: {String(action.supplierName ?? "")}</div>
        )}

        {action.action === "createProjectFromMonday" && (
          <>
            <div>Board: {String(action.boardId ?? "")}</div>
            {Array.isArray(action.items) ? (
              <div>{action.items.length} draft project(s) will be created from Monday items.</div>
            ) : (
              <div>Item: {String(action.itemId ?? "")}</div>
            )}
            <div className="text-[10px] opacity-80">Creates draft project(s) with name, job #, and client from the Monday item(s).</div>
          </>
        )}

        {action.action === "receiveInventory" && (
          <>
            <div>Material: <strong>{String(action.materialCode)}</strong></div>
            <div>Qty to receive: <strong>{String(action.quantity)}</strong></div>
            {action.note && <div>Note: {String(action.note)}</div>}
            {action.orderId && <div>Against order: {String(action.orderId)}</div>}
            <div className="text-[10px] opacity-80">Updates onHand stock and creates a StockMovement record.</div>
          </>
        )}

        {action.action === "createInventoryItem" && (
          <>
            <div>Code: <strong>{String(action.materialCode)}</strong></div>
            <div>Description: {String(action.description)}</div>
            <div>Unit: {String(action.unit ?? "sheets")} — Category: {String(action.category ?? "sheetGoods")}</div>
            {(action.onHand as number) > 0 && <div>Initial stock: {String(action.onHand)}</div>}
          </>
        )}

        {action.action === "updateProjectStatus" && (
          <>
            <div>Project: {String(action.projectId)}</div>
            <div>New status: <strong>{String(action.status)}</strong></div>
          </>
        )}

        {action.action === "receiveOrder" && (
          <>
            <div>Order ID: {String(action.orderId)}</div>
            {Array.isArray(action.lines) ? (
              <div>Receiving {(action.lines as unknown[]).length} specific line(s) (partial receipt).</div>
            ) : (
              <div>Receiving all lines at their ordered quantities.</div>
            )}
            <div className="text-[10px] opacity-80">Updates inventory onHand and advances order status.</div>
          </>
        )}
      </div>

      <div className="flex gap-2">
        <button
          onClick={onApprove}
          disabled={isExecuting}
          className="neo-btn-primary px-3 py-1.5 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isExecuting ? "Executing…" : "Approve"}
        </button>
        <button
          onClick={onReject}
          disabled={isExecuting}
          className="neo-btn px-3 py-1.5 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

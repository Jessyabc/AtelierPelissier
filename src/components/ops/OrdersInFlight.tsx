"use client";

import Link from "next/link";
import type { OrderInFlight } from "@/app/home/page";

const statusBadge: Record<string, string> = {
  draft: "bg-gray-200 text-gray-700",
  placed: "bg-blue-100 text-blue-700",
  partial: "bg-yellow-100 text-yellow-700",
};

export function OrdersInFlight({
  orders,
  onReceive,
}: {
  orders: OrderInFlight[];
  onReceive: (orderId: string) => void;
}) {
  return (
    <section>
      <h2 className="text-lg font-semibold text-[var(--foreground)] mb-3">
        Orders In-Flight
      </h2>
      <div className="space-y-3">
        {orders.map((order) => (
          <div
            key={order.id}
            className={`neo-card p-4 ${order.isLate ? "severity-high" : ""} ${order.isBackordered ? "severity-medium" : ""}`}
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div>
                  <span className="font-semibold text-sm text-[var(--foreground)]">
                    {order.supplier}
                  </span>
                  <span className={`ml-2 text-xs px-2 py-0.5 rounded-full ${statusBadge[order.status] ?? "bg-gray-100"}`}>
                    {order.status}
                  </span>
                  {order.orderType === "reserve" && (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      reservation
                    </span>
                  )}
                  {order.isLate && (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">
                      LATE
                    </span>
                  )}
                  {order.isBackordered && (
                    <span className="ml-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                      backordered
                    </span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {order.project && (
                  <Link
                    href={`/projects/${order.project.id}`}
                    className="text-xs bg-[var(--bg-light)] px-2 py-1 rounded-full hover:bg-[var(--accent-soft)] transition-colors"
                  >
                    {order.project.jobNumber ?? order.project.name}
                  </Link>
                )}
                {(order.status === "placed" || order.status === "partial") && (
                  <button
                    onClick={() => onReceive(order.id)}
                    className="neo-btn-primary px-3 py-1.5 text-xs font-medium"
                  >
                    Receive
                  </button>
                )}
              </div>
            </div>

            <div className="flex gap-4 mt-2 text-xs text-[var(--foreground-muted)]">
              {order.placedAt && (
                <span>Placed: {new Date(order.placedAt).toLocaleDateString("en-CA")}</span>
              )}
              {order.expectedDeliveryDate && (
                <span>Expected: {new Date(order.expectedDeliveryDate).toLocaleDateString("en-CA")}</span>
              )}
              <span>
                Lines: {order.receivedLines}/{order.totalLines} received
              </span>
              {order.isBackordered && order.backorderNotes && (
                <span className="text-yellow-600">Note: {order.backorderNotes}</span>
              )}
            </div>

            {/* Compact line summary */}
            {order.lines.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {order.lines.map((line) => {
                  const complete = line.receivedQty >= line.quantity;
                  return (
                    <span
                      key={line.id}
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        complete
                          ? "bg-emerald-100 text-emerald-700"
                          : line.hasDeviation
                            ? "bg-red-100 text-red-700"
                            : "bg-[var(--bg-light)] text-[var(--foreground-muted)]"
                      }`}
                    >
                      {line.description}: {line.receivedQty}/{line.quantity}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

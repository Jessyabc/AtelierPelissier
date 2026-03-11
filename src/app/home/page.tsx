"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ProjectHealthStrip } from "@/components/ops/ProjectHealthStrip";
import { ShortagePanel } from "@/components/ops/ShortagePanel";
import { OrdersInFlight } from "@/components/ops/OrdersInFlight";
import { DeviationFeed } from "@/components/ops/DeviationFeed";

type CockpitData = {
  projectHealth: ProjectHealth[];
  shortagesBySupplier: SupplierShortageGroup[];
  ordersInFlight: OrderInFlight[];
  deviations: Deviation[];
  stats: {
    totalActive: number;
    totalShortages: number;
    ordersPending: number;
    onTrackPct: number;
  };
};

export type ProjectHealth = {
  id: string;
  name: string;
  jobNumber: string | null;
  type: string;
  isDraft: boolean;
  targetDate: string | null;
  productionDelayWeeks: number;
  clientName: string | null;
  deviationCount: number;
  worstSeverity: string | null;
  fulfillmentPct: number;
  margin: number;
  estimateCost: number;
  actualCost: number;
};

export type ShortageItem = {
  materialCode: string;
  inventoryItemId: string;
  description: string;
  shortageQty: number;
  requiredQty: number;
  availableQty: number;
  incomingQty: number;
  projects: { id: string; name: string; jobNumber: string | null; requiredQty: number }[];
};

export type SupplierShortageGroup = {
  supplierId: string;
  supplierName: string;
  supplierEmail: string | null;
  items: ShortageItem[];
};

export type OrderLineInfo = {
  id: string;
  materialCode: string;
  description: string;
  quantity: number;
  receivedQty: number;
  unitCost: number;
  hasDeviation: boolean;
};

export type OrderInFlight = {
  id: string;
  supplier: string;
  status: string;
  orderType: string;
  expectedDeliveryDate: string | null;
  placedAt: string | null;
  isLate: boolean;
  isBackordered: boolean;
  backorderNotes: string | null;
  backorderExpectedDate: string | null;
  project: { id: string; name: string; jobNumber: string | null } | null;
  totalLines: number;
  receivedLines: number;
  lines: OrderLineInfo[];
};

export type Deviation = {
  id: string;
  projectId: string | null;
  type: string;
  severity: string;
  groupKey: string | null;
  message: string;
  impactValue: number | null;
  createdAt: string;
};

export default function OperationsCockpit() {
  const [data, setData] = useState<CockpitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchaseModalOpen, setPurchaseModalOpen] = useState(false);
  const [purchaseSupplierGroup, setPurchaseSupplierGroup] = useState<SupplierShortageGroup | null>(null);
  const [receiveOrderId, setReceiveOrderId] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/ops/cockpit");
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function handleOrderFromSupplier(group: SupplierShortageGroup) {
    setPurchaseSupplierGroup(group);
    setPurchaseModalOpen(true);
  }

  function handleReceiveOrder(orderId: string) {
    setReceiveOrderId(orderId);
  }

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="neo-card p-8 text-center text-[var(--foreground-muted)]">
          Loading operations cockpit...
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="neo-card p-8 text-center text-red-500">
          Failed to load cockpit data. <button onClick={load} className="underline">Retry</button>
        </div>
      </div>
    );
  }

  const { projectHealth, shortagesBySupplier, ordersInFlight, deviations, stats } = data;

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--foreground)]">Operations Cockpit</h1>
          <p className="text-sm text-[var(--foreground-muted)] mt-1">
            Single view of everything that needs your attention
          </p>
        </div>
        <button onClick={load} className="neo-btn px-4 py-2 text-sm">
          Refresh
        </button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard label="Active Projects" value={stats.totalActive} />
        <StatCard
          label="Material Shortages"
          value={stats.totalShortages}
          alert={stats.totalShortages > 0}
        />
        <StatCard
          label="Orders Pending"
          value={stats.ordersPending}
        />
        <StatCard
          label="On Track"
          value={`${stats.onTrackPct}%`}
          positive={stats.onTrackPct >= 80}
        />
      </div>

      {/* Project Health Strip */}
      <ProjectHealthStrip projects={projectHealth} />

      {/* Shortages by Supplier */}
      {shortagesBySupplier.length > 0 && (
        <ShortagePanel
          groups={shortagesBySupplier}
          onOrder={handleOrderFromSupplier}
        />
      )}

      {/* Orders In-Flight */}
      {ordersInFlight.length > 0 && (
        <OrdersInFlight
          orders={ordersInFlight}
          onReceive={handleReceiveOrder}
        />
      )}

      {/* Deviation Feed */}
      {deviations.length > 0 && (
        <DeviationFeed deviations={deviations} />
      )}

      {/* Empty state */}
      {shortagesBySupplier.length === 0 && ordersInFlight.length === 0 && deviations.length === 0 && (
        <div className="neo-card p-8 text-center">
          <p className="text-[var(--foreground-muted)]">
            All clear — no shortages, no pending orders, no deviations.
          </p>
          <Link href="/projects/new" className="neo-btn-primary px-5 py-2.5 text-sm font-medium inline-block mt-4">
            New Project
          </Link>
        </div>
      )}

      {/* Purchase Flow Modal */}
      {purchaseModalOpen && purchaseSupplierGroup && (
        <PurchaseFlowModalLazy
          group={purchaseSupplierGroup}
          onClose={() => { setPurchaseModalOpen(false); setPurchaseSupplierGroup(null); }}
          onComplete={() => { setPurchaseModalOpen(false); setPurchaseSupplierGroup(null); load(); }}
        />
      )}

      {/* Receive Order Modal */}
      {receiveOrderId && (
        <ReceiveOrderModalLazy
          orderId={receiveOrderId}
          onClose={() => setReceiveOrderId(null)}
          onComplete={() => { setReceiveOrderId(null); load(); }}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  alert,
  positive,
}: {
  label: string;
  value: string | number;
  alert?: boolean;
  positive?: boolean;
}) {
  let cardClass = "neo-card p-4 text-center";
  if (alert) cardClass = "neo-card p-4 text-center severity-high";
  if (positive) cardClass = "neo-card p-4 text-center severity-low";

  return (
    <div className={cardClass}>
      <div className="text-2xl font-bold text-[var(--foreground)]">{value}</div>
      <div className="text-xs text-[var(--foreground-muted)] mt-1">{label}</div>
    </div>
  );
}

// Lazy wrappers — these components are built in subsequent steps
function PurchaseFlowModalLazy({
  group,
  onClose,
  onComplete,
}: {
  group: SupplierShortageGroup;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { PurchaseFlowModal } = require("@/components/ops/PurchaseFlowModal");
  return <PurchaseFlowModal group={group} onClose={onClose} onComplete={onComplete} />;
}

function ReceiveOrderModalLazy({
  orderId,
  onClose,
  onComplete,
}: {
  orderId: string;
  onClose: () => void;
  onComplete: () => void;
}) {
  const { ReceiveOrderModal } = require("@/components/ops/ReceiveOrderModal");
  return <ReceiveOrderModal orderId={orderId} onClose={onClose} onComplete={onComplete} />;
}

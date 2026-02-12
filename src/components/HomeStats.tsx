"use client";

import Link from "next/link";

export type StatsData = {
  projects: {
    total: number;
    drafts: number;
    saved: number;
    draftPercent: number;
    savedPercent: number;
  };
  serviceCalls: {
    total: number;
    completed: number;
    completedPercent: number;
    upcomingThisWeek: number;
  };
  calendar: { eventsToday: number };
  distributors: { count: number };
  orders: {
    total: number;
    open: number;
    byStatus: Record<string, number>;
  };
  deviations: {
    total: number;
    bySeverity: Record<string, number>;
  };
  estimates: { totalValue: number };
};

/** Circular progress ring — percentage 0–100 */
function CircularRing({
  percent,
  size = 80,
  strokeWidth = 8,
  color = "var(--accent)",
}: {
  percent: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
}) {
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference - (percent / 100) * circumference;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--shadow-dark)"
        strokeWidth={strokeWidth}
        opacity={0.3}
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-all duration-500"
      />
    </svg>
  );
}

/** Donut-style chart for multiple segments (e.g. draft vs saved) */
function DonutChart({
  segments,
  size = 80,
  strokeWidth = 10,
}: {
  segments: Array<{ value: number; color: string }>;
  size?: number;
  strokeWidth?: number;
}) {
  const total = segments.reduce((s, seg) => s + seg.value, 0);
  if (total === 0) {
    return (
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={(size - strokeWidth) / 2}
          fill="none"
          stroke="var(--shadow-dark)"
          strokeWidth={strokeWidth}
          opacity={0.3}
        />
      </svg>
    );
  }
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const segLen = circumference * pct;
        const dashArray = `${segLen} ${circumference}`;
        const dashOffset = -offset;
        offset += segLen;
        return (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth={strokeWidth}
            strokeDasharray={dashArray}
            strokeDashoffset={dashOffset}
            strokeLinecap="round"
          />
        );
      })}
    </svg>
  );
}

function StatCard({
  title,
  value,
  subtitle,
  href,
  ring,
  donut,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  href?: string;
  ring?: { percent: number; color?: string };
  donut?: { segments: Array<{ value: number; color: string }> };
}) {
  const content = (
    <div className="neo-card flex items-center gap-4 p-4 transition-all hover:shadow-[6px_6px_12px_var(--shadow-dark),-6px_-6px_12px_var(--shadow-light)]">
      <div className="relative flex shrink-0 items-center justify-center">
        {ring && (
          <>
            <CircularRing percent={ring.percent} color={ring.color} />
            <span className="absolute text-center text-sm font-semibold text-gray-800">
              {Math.round(ring.percent)}%
            </span>
          </>
        )}
        {donut && (
          <>
            <DonutChart segments={donut.segments} />
            <span className="absolute text-center text-sm font-semibold text-gray-800">
              {value}
            </span>
          </>
        )}
        {!ring && !donut && (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl font-bold text-[var(--accent)]">
            {value}
          </div>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
          {title}
        </p>
        <p className="mt-0.5 text-xl font-semibold text-gray-900">
          {ring || donut ? (
            <>
              {value}
              {subtitle && (
                <span className="ml-1 text-sm font-normal text-gray-600">
                  {subtitle}
                </span>
              )}
            </>
          ) : (
            value
          )}
        </p>
        {subtitle && !ring && !donut && (
          <p className="mt-0.5 text-sm text-gray-600">{subtitle}</p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    );
  }
  return content;
}

export function HomeStats({ data }: { data: StatsData }) {
  const { projects, serviceCalls, calendar, distributors, orders, deviations, estimates } = data;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-800">At a glance</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard
          title="Projects"
          value={projects.total}
          subtitle={
            projects.total > 0
              ? `${projects.saved} saved · ${projects.drafts} drafts`
              : undefined
          }
          href="/"
          donut={
            projects.total > 0
              ? {
                  segments: [
                    { value: projects.saved, color: "var(--accent)" },
                    { value: projects.drafts, color: "var(--shadow-dark)" },
                  ],
                }
              : undefined
          }
        />
        <StatCard
          title="Service calls"
          value={serviceCalls.total}
          subtitle={
            serviceCalls.total > 0
              ? `${serviceCalls.completed} completed · ${serviceCalls.upcomingThisWeek} this week`
              : undefined
          }
          href="/service-calls"
          ring={
            serviceCalls.total > 0
              ? { percent: serviceCalls.completedPercent, color: "var(--brand-green)" }
              : undefined
          }
        />
        <StatCard
          title="Calendar today"
          value={calendar.eventsToday}
          subtitle="events scheduled"
          href="/calendar"
        />
        <StatCard
          title="Distributors"
          value={distributors.count}
          href="/distributors"
        />
        <StatCard
          title="Estimates total"
          value={`$${estimates.totalValue.toLocaleString("en-CA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
        />
        <StatCard
          title="Open orders"
          value={orders.open}
          subtitle={
            orders.total > 0
              ? Object.entries(orders.byStatus)
                  .filter(([k]) => k !== "received")
                  .map(([k, v]) => `${k}: ${v}`)
                  .join(" · ")
              : undefined
          }
          donut={
            orders.open > 0
              ? {
                  segments: Object.entries(orders.byStatus)
                    .filter(([status]) => status !== "received")
                    .map(([status, count]) => ({
                      value: count,
                      color:
                        status === "placed"
                          ? "var(--accent)"
                          : status === "partial"
                            ? "#f59e0b"
                            : "var(--shadow-dark)",
                    })),
                }
              : undefined
          }
        />
        <StatCard
          title="Deviations"
          value={deviations.total}
          subtitle={
            deviations.total > 0
              ? Object.entries(deviations.bySeverity)
                  .map(([s, c]) => `${s}: ${c}`)
                  .join(" · ")
              : undefined
          }
          href="/dashboard"
          donut={
            deviations.total > 0
              ? {
                  segments: Object.entries(deviations.bySeverity).map(
                    ([severity, count]) => ({
                      value: count,
                      color:
                        severity === "critical"
                          ? "#dc2626"
                          : severity === "high"
                            ? "#f59e0b"
                            : severity === "medium"
                              ? "#eab308"
                              : "var(--shadow-dark)",
                    })
                  ),
                }
              : undefined
          }
        />
      </div>
    </section>
  );
}

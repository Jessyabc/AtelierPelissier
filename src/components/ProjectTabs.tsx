"use client";

type Tab = string;

export function ProjectTabs({
  tabs,
  activeTab,
  onSelect,
}: {
  tabs: readonly Tab[];
  activeTab: Tab;
  onSelect: (tab: Tab) => void;
}) {
  return (
    <nav className="neo-segment flex overflow-x-auto gap-1 pb-0" aria-label="Project sections">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onSelect(tab)}
          className={
            "shrink-0 rounded-lg px-3 py-2 text-sm font-medium transition-all sm:px-4 " +
            (activeTab === tab
              ? "neo-btn-pressed text-[var(--accent-hover)]"
              : "neo-segment-btn")
          }
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

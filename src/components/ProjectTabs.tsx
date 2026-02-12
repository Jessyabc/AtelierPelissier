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
    <nav className="flex gap-1 overflow-x-auto border-b border-gray-200 pb-px" aria-label="Project sections">
      {tabs.map((tab) => (
        <button
          key={tab}
          type="button"
          onClick={() => onSelect(tab)}
          className={
            "shrink-0 border-b-2 px-3 py-2 text-sm font-medium transition-colors sm:px-4 " +
            (activeTab === tab
              ? "border-brand-dark text-brand-dark"
              : "border-transparent text-gray-600 hover:border-brand-blue/30 hover:text-gray-800")
          }
        >
          {tab}
        </button>
      ))}
    </nav>
  );
}

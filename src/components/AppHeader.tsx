"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";

const MENU_ITEMS = [
  { href: "/", label: "Projects" },
  { href: "/dashboard", label: "Executive Dashboard" },
  { href: "/projects/new", label: "New project" },
  { href: "/processes", label: "Processes" },
  { href: "/inventory", label: "Inventory" },
  { href: "/purchasing", label: "Purchasing" },
  { href: "/costing", label: "Costing" },
  { href: "/service-calls", label: "Service calls" },
  { href: "/calendar", label: "Calendar" },
  { href: "/distributors", label: "Distributors" },
  { href: "/settings/risk", label: "Risk settings" },
  { href: "#", label: "Export data (backup)", exportData: true },
];

export function AppHeader() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="app-header border-b border-black/20 px-4 py-3 sm:px-6 sm:py-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="relative flex shrink-0" ref={menuRef}>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex cursor-pointer items-center gap-3 rounded hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-white/50"
            aria-expanded={open}
            aria-haspopup="true"
            aria-label="Open menu"
          >
            <img
              src="/logo.svg"
              alt="Atelier Pelissier"
              className="h-8 w-auto sm:h-10"
              width={120}
              height={48}
            />
          </button>
          {open && (
            <nav
              className="neo-dropdown absolute left-0 top-full z-50 mt-3 min-w-[200px] rounded-xl py-2"
              role="menu"
            >
              {MENU_ITEMS.map((item) =>
                (item as { exportData?: boolean }).exportData ? (
                  <button
                    key={item.label}
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      try {
                        const res = await fetch("/api/export");
                        if (!res.ok) throw new Error("Export failed");
                        const blob = await res.blob();
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement("a");
                        a.href = url;
                        a.download = res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ?? `atelier-backup-${new Date().toISOString().slice(0, 10)}.json`;
                        a.click();
                        URL.revokeObjectURL(url);
                      } catch {
                        window.open("/api/export", "_blank");
                      }
                    }}
                    role="menuitem"
                    className="block w-full px-5 py-2.5 text-left text-sm text-gray-700 hover:bg-white/50 transition-colors"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.href as string}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className={`block px-5 py-2.5 text-sm transition-colors ${
                      pathname === item.href
                        ? "font-medium text-[var(--accent-hover)] bg-white/60"
                        : "text-gray-700 hover:bg-white/50"
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              )}
            </nav>
          )}
        </div>
        <span className="hidden text-sm text-white/70 sm:inline">Pricing Engine · Internal use</span>
      </div>
    </header>
  );
}

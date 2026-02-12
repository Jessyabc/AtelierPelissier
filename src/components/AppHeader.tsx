"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useRef, useEffect, useState } from "react";

const MENU_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/projects/new", label: "New project" },
  { href: "/service-calls", label: "Service calls" },
  { href: "/calendar", label: "Calendar" },
  { href: "/distributors", label: "Distributors" },
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
              className="absolute left-0 top-full z-50 mt-2 min-w-[180px] rounded-lg border border-gray-200 bg-white py-1 shadow-lg"
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
                    className="block w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100"
                  >
                    {item.label}
                  </button>
                ) : (
                  <Link
                    key={item.href as string}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    role="menuitem"
                    className={`block px-4 py-2 text-sm hover:bg-gray-100 ${
                      pathname === item.href
                        ? "font-medium text-brand-dark bg-gray-50"
                        : "text-gray-700"
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

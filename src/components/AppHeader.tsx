"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useRef, useEffect, useState } from "react";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { isMenuItemAllowedForRole } from "@/lib/auth/roles";

type MenuItemConfig = {
  href: string;
  label: string;
  visible: boolean;
  order: number;
  exportData?: boolean;
};

const FALLBACK_MENU: MenuItemConfig[] = [
  { href: "/home", label: "Operations Cockpit", visible: true, order: 0 },
  { href: "/", label: "Projects", visible: true, order: 1 },
  { href: "/projects/new", label: "New project", visible: true, order: 2 },
  { href: "/assistant", label: "AI Assistant", visible: true, order: 3 },
  { href: "/dashboard", label: "Executive Dashboard", visible: true, order: 4 },
  { href: "/inventory", label: "Inventory", visible: true, order: 5 },
  { href: "/distributors", label: "Suppliers & Purchasing", visible: true, order: 6 },
  { href: "/costing", label: "Costing", visible: true, order: 7 },
  { href: "/processes", label: "Processes", visible: true, order: 8 },
  { href: "/service-calls", label: "Service calls", visible: true, order: 9 },
  { href: "/calendar", label: "Calendar", visible: true, order: 10 },
  { href: "/settings/risk", label: "Risk settings", visible: true, order: 11 },
  { href: "/admin", label: "Admin Hub", visible: true, order: 12 },
  { href: "/admin/employees", label: "Team Members", visible: true, order: 13 },
  { href: "/admin/stations", label: "Work Stations & QR", visible: true, order: 14 },
  { href: "/admin/punches", label: "Punch Board", visible: true, order: 15 },
  { href: "#export", label: "Export data (backup)", visible: true, order: 16, exportData: true },
];

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(FALLBACK_MENU);
  const [companyName, setCompanyName] = useState("Atelier Pelissier");
  const [logoUrl, setLogoUrl] = useState("/logo.svg");
  const [userRole, setUserRole] = useState<string>("admin");
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/config").then((r) => (r.ok ? r.json() : null)),
      fetch("/api/auth/me").then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([cfg, me]) => {
        if (cfg) {
          if (cfg.companyName) setCompanyName(cfg.companyName);
          if (cfg.logoUrl) setLogoUrl(cfg.logoUrl);
          if (Array.isArray(cfg.menuConfig) && cfg.menuConfig.length > 0) {
            setMenuItems(
              [...cfg.menuConfig].sort((a: MenuItemConfig, b: MenuItemConfig) => a.order - b.order)
            );
          }
        }
        if (me?.user?.role) setUserRole(me.user.role);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const visibleItems = menuItems
    .filter((m) => m.visible)
    .filter((m) => isMenuItemAllowedForRole(m.href, userRole));

  if (pathname === "/login" || pathname?.startsWith("/auth")) {
    return null;
  }

  async function handleSignOut() {
    try {
      const supabase = getBrowserSupabaseClient();
      await supabase.auth.signOut();
    } catch {
      // Supabase may be unset in local dev
    }
    router.push("/login");
    router.refresh();
  }

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
              src={logoUrl}
              alt={companyName}
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
              {visibleItems.map((item) =>
                item.exportData ? (
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
                    key={item.href}
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
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-sm text-white/70 sm:inline">Operations · Internal use</span>
          <button
            type="button"
            onClick={() => void handleSignOut()}
            className="rounded border border-white/20 px-2 py-1 text-xs text-white/80 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </div>
    </header>
  );
}

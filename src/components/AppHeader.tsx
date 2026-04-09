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
  group?: string;
  exportData?: boolean;
};

type MenuGroup = { label: string; items: MenuItemConfig[] };

const GROUPED_MENU: MenuItemConfig[] = [
  { href: "/", label: "Projects", visible: true, order: 0, group: "Work" },
  { href: "/projects/new", label: "New Project", visible: true, order: 1, group: "Work" },
  { href: "/service-calls", label: "Service Calls", visible: true, order: 2, group: "Work" },
  { href: "/calendar", label: "Calendar", visible: true, order: 3, group: "Work" },

  { href: "/home", label: "Cockpit", visible: true, order: 10, group: "Ops" },
  { href: "/dashboard", label: "Dashboard", visible: true, order: 11, group: "Ops" },
  { href: "/inventory", label: "Inventory", visible: true, order: 12, group: "Ops" },
  { href: "/distributors", label: "Purchasing", visible: true, order: 13, group: "Ops" },
  { href: "/costing", label: "Costing", visible: true, order: 14, group: "Ops" },

  { href: "/assistant", label: "Afaqi", visible: true, order: 20, group: "Tools" },
  { href: "/processes", label: "Processes", visible: true, order: 21, group: "Tools" },

  { href: "/admin", label: "Admin Hub", visible: true, order: 30, group: "Config" },
  { href: "#export", label: "Export Backup", visible: true, order: 31, group: "Config", exportData: true },
];

function buildGroups(items: MenuItemConfig[], role: string): MenuGroup[] {
  const visible = items
    .filter((m) => m.visible)
    .filter((m) => isMenuItemAllowedForRole(m.href, role))
    .sort((a, b) => a.order - b.order);

  const map = new Map<string, MenuItemConfig[]>();
  for (const item of visible) {
    const g = item.group || "Other";
    if (!map.has(g)) map.set(g, []);
    map.get(g)!.push(item);
  }

  return Array.from(map.entries()).map(([label, items]) => ({ label, items }));
}

export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [menuItems, setMenuItems] = useState<MenuItemConfig[]>(GROUPED_MENU);
  const [companyName, setCompanyName] = useState("Atelier Pelissier");
  const [logoUrl, setLogoUrl] = useState("/logo.svg");
  const [userRole, setUserRole] = useState<string>("admin");
  const [impersonation, setImpersonation] = useState<null | { role: string }>(null);
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
        if (me?.user?.impersonation?.role) setImpersonation({ role: me.user.impersonation.role });
        else setImpersonation(null);
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

  const groups = buildGroups(menuItems, userRole);

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

  async function clearImpersonation() {
    try {
      await fetch("/api/admin/impersonation", { method: "DELETE" });
    } catch {
      // ignore
    } finally {
      setImpersonation(null);
      router.refresh();
    }
  }

  async function handleExport() {
    setOpen(false);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        res.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] ??
        `atelier-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.open("/api/export", "_blank");
    }
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
              className="neo-dropdown absolute left-0 top-full z-50 mt-3 min-w-[220px] rounded-xl py-2"
              role="menu"
            >
              {groups.map((group, gi) => (
                <div key={group.label}>
                  {gi > 0 && <div className="my-1.5 border-t border-gray-200/60" />}
                  <div className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    {group.label}
                  </div>
                  {group.items.map((item) =>
                    item.exportData ? (
                      <button
                        key={item.label}
                        type="button"
                        onClick={handleExport}
                        role="menuitem"
                        className="block w-full px-5 py-2 text-left text-sm text-gray-700 hover:bg-white/50 transition-colors"
                      >
                        {item.label}
                      </button>
                    ) : (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setOpen(false)}
                        role="menuitem"
                        className={`block px-5 py-2 text-sm transition-colors ${
                          pathname === item.href
                            ? "font-medium text-[var(--accent-hover)] bg-white/60"
                            : "text-gray-700 hover:bg-white/50"
                        }`}
                      >
                        {item.label}
                      </Link>
                    )
                  )}
                </div>
              ))}
            </nav>
          )}
        </div>
        <div className="ml-auto flex items-center gap-3">
          {impersonation?.role && (
            <button
              type="button"
              onClick={() => void clearImpersonation()}
              className="hidden sm:inline-flex items-center gap-2 rounded border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
              title="You are viewing as another role. Click to exit."
            >
              Viewing as <span className="font-semibold">{impersonation.role}</span> (exit)
            </button>
          )}
          <span className="hidden text-sm text-white/70 sm:inline">{companyName}</span>
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

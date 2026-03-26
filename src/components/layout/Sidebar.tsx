"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Pill,
  Users,
  Kanban,
  Settings,
  ClipboardList,
  Truck,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/deals", label: "Deals", icon: ClipboardList },
  { href: "/ingredients", label: "Ingredients", icon: Pill },
  { href: "/suppliers", label: "Suppliers", icon: Truck },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true); // Hidden by default

  return (
    <>
      {/* Sidebar */}
      <aside className={`fixed left-0 top-0 z-40 h-screen bg-[#1a1a2e] text-white flex flex-col transition-all duration-200 ${
        collapsed ? "w-16" : "w-64"
      }`}>
        {/* Header */}
        <div className={`flex items-center border-b border-white/10 ${collapsed ? "px-3 py-4 justify-center" : "px-6 py-5 justify-between"}`}>
          {!collapsed && (
            <div>
              <h1 className="text-xl font-bold">
                <span className="text-[#d10a11]">Opti</span>bio ERP
              </h1>
              <p className="text-xs text-white/50 mt-1">Nutraceutical Management</p>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 rounded-lg text-sm font-medium transition-colors ${
                  collapsed ? "px-3 py-2.5 justify-center" : "px-3 py-2.5"
                } ${
                  isActive
                    ? "bg-white/10 text-white border-l-3 border-[#d10a11]"
                    : "text-white/60 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className={`py-4 border-t border-white/10 ${collapsed ? "px-2 text-center" : "px-6"}`}>
          {collapsed ? (
            <span className="text-[9px] text-white/30 font-bold">OB</span>
          ) : (
            <p className="text-xs text-white/40">Optibio Supplements</p>
          )}
        </div>
      </aside>

      {/* Overlay for expanded sidebar on mobile */}
      {!collapsed && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setCollapsed(true)} />
      )}
    </>
  );
}

// Export hook for other components to know sidebar width
export function useSidebarWidth() {
  // This is a simple approach — for a shared state solution, use context
  return 64; // Default collapsed width
}

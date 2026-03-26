"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { FileText, Pill, PanelLeftClose, PanelLeftOpen } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Quotes", icon: FileText },
  { href: "/ingredients", label: "Ingredients", icon: Pill },
];

export default function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(true);

  return (
    <aside className={`fixed left-0 top-0 z-40 h-screen bg-[#1a1a2e] text-white flex flex-col transition-all duration-200 ${
      collapsed ? "w-14" : "w-56"
    }`}>
      <div className={`flex items-center border-b border-white/10 ${collapsed ? "px-2.5 py-3 justify-center" : "px-4 py-4 justify-between"}`}>
        {!collapsed && (
          <h1 className="text-base font-bold">
            <span className="text-[#d10a11]">Opti</span>bio
          </h1>
        )}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/60 hover:text-white"
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.href === "/" ? pathname === "/" || pathname.startsWith("/quotes") : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 rounded-lg text-sm font-medium transition-colors ${
                collapsed ? "px-2.5 py-2 justify-center" : "px-3 py-2"
              } ${isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}

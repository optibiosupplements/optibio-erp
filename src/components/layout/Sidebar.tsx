"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  FlaskConical,
  Pill,
  Users,
  Kanban,
  Package,
  Settings,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/quotes", label: "Quotes", icon: FileText },
  { href: "/formulations", label: "Formulations", icon: FlaskConical },
  { href: "/ingredients", label: "Ingredients", icon: Pill },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/pipeline", label: "Pipeline", icon: Kanban },
  { href: "/packaging", label: "Packaging", icon: Package },
  { href: "/settings", label: "Settings", icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 z-40 h-screen w-64 bg-[#1a1a2e] text-white flex flex-col">
      <div className="px-6 py-5 border-b border-white/10">
        <h1 className="text-xl font-bold">
          <span className="text-[#d10a11]">Opti</span>Bio ERP
        </h1>
        <p className="text-xs text-white/50 mt-1">Nutraceutical Management</p>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
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
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-white/10 text-white border-l-3 border-[#d10a11]"
                  : "text-white/60 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-white/40">OptiBio Supplements</p>
      </div>
    </aside>
  );
}

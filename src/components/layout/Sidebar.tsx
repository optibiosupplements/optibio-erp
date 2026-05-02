"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, Inbox, FlaskConical, FileText, ShoppingCart, Factory, Package,
  FileCheck, Users, Building2, Pill, Settings, PanelLeftClose, PanelLeftOpen, LogOut,
  TrendingUp, Truck,
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, match: (p: string) => p === "/" },
  { href: "/pipeline", label: "Pipeline", icon: TrendingUp, match: (p: string) => p.startsWith("/pipeline") },
  { href: "/intake", label: "Intake", icon: Inbox, match: (p: string) => p.startsWith("/intake") },
  { href: "/formulations", label: "The Lab", icon: FlaskConical, match: (p: string) => p.startsWith("/formulations") },
  { href: "/quotes", label: "Quotes", icon: FileText, match: (p: string) => p.startsWith("/quotes") },
  { href: "/orders", label: "Orders", icon: ShoppingCart, match: (p: string) => p.startsWith("/orders") },
  { href: "/batches", label: "Production", icon: Factory, match: (p: string) => p.startsWith("/batches") },
  { href: "/lots", label: "Lots", icon: Package, match: (p: string) => p.startsWith("/lots") },
  { href: "/coas", label: "COAs", icon: FileCheck, match: (p: string) => p.startsWith("/coas") },
  { href: "/shipments", label: "Shipments", icon: Truck, match: (p: string) => p.startsWith("/shipments") },
  { href: "/customers", label: "Customers", icon: Users, match: (p: string) => p.startsWith("/customers") },
  { href: "/suppliers", label: "Suppliers", icon: Building2, match: (p: string) => p.startsWith("/suppliers") },
  { href: "/ingredients", label: "Ingredients", icon: Pill, match: (p: string) => p.startsWith("/ingredients") },
  { href: "/settings", label: "Settings", icon: Settings, match: (p: string) => p.startsWith("/settings") },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className={`fixed left-0 top-0 z-40 h-screen bg-[#1a1a2e] text-white flex flex-col transition-all duration-200 ${
      collapsed ? "w-14" : "w-52"
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
          title={collapsed ? "Expand" : "Collapse"}
        >
          {collapsed ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </div>

      <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = item.match(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={collapsed ? item.label : undefined}
              className={`flex items-center gap-2.5 rounded-md text-sm font-medium transition-colors ${
                collapsed ? "px-2.5 py-2 justify-center" : "px-3 py-2"
              } ${isActive ? "bg-white/10 text-white" : "text-white/50 hover:text-white hover:bg-white/5"}`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/10 p-2">
        <button
          onClick={logout}
          title={collapsed ? "Sign out" : undefined}
          className={`w-full flex items-center gap-2.5 rounded-md text-sm font-medium text-white/50 hover:text-white hover:bg-white/5 transition-colors ${
            collapsed ? "px-2.5 py-2 justify-center" : "px-3 py-2"
          }`}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Sign out</span>}
        </button>
      </div>
    </aside>
  );
}

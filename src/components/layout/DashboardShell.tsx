"use client";

import Sidebar from "./Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      {/* ml-16 matches the collapsed sidebar width (w-16) */}
      <main className="ml-16 min-h-screen transition-all duration-200">
        <div className="px-8 py-6">{children}</div>
      </main>
    </div>
  );
}

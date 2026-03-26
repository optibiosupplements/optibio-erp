"use client";

import Sidebar from "./Sidebar";

export default function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-14 min-h-screen transition-all duration-200">
        <div className="px-6 py-5">{children}</div>
      </main>
    </div>
  );
}

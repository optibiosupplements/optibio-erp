"use client";

import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2, AlertCircle } from "lucide-react";

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        });
        if (res.ok) {
          router.push(next);
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          setError(data.error || "Wrong password.");
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        setError(msg);
      }
    });
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="h-5 w-5 text-[#d10a11]" />
          <h1 className="text-lg font-bold text-slate-900">Optibio ERP</h1>
        </div>
        <p className="text-xs text-slate-500 mb-5">Enter the operator password to continue.</p>

        <label htmlFor="pw" className="block text-xs font-medium text-slate-600 uppercase tracking-wide mb-1">
          Password
        </label>
        <input
          id="pw"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoFocus
          className="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-[#d10a11] focus:ring-1 focus:ring-[#d10a11]/30"
        />

        {error && (
          <div className="mt-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 flex items-start gap-2">
            <AlertCircle className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={pending || !password}
          className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#d10a11] hover:bg-[#a30a0f] disabled:opacity-50 text-white text-sm font-semibold rounded-md transition-colors"
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Sign in
        </button>

        <p className="mt-5 text-[11px] text-slate-400 text-center">
          Phase 1 single-operator gate. To rotate the password, change{" "}
          <code className="font-mono">APP_PASSWORD</code> in your env.
        </p>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}

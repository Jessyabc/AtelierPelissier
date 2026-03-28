"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getBrowserSupabaseClient } from "@/lib/supabase/client";
import { getDefaultLandingPage } from "@/lib/auth/roles";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/";
  const invite = searchParams.get("invite");

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const { error: err } = await supabase.auth.signInWithPassword({ email, password });
      if (err) {
        setError(err.message);
        return;
      }
      if (invite) {
        await fetch("/api/auth/redeem-invite", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token: invite }),
        });
      }
      // Role-specific landing: if user came from a direct link, honor it; otherwise land by role
      if (next && next !== "/") {
        router.push(next);
      } else {
        const me = await fetch("/api/auth/me").then((r) => r.ok ? r.json() : null).catch(() => null);
        const role = (me?.user?.role as string) ?? "admin";
        router.push(getDefaultLandingPage(role));
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (!invite) {
      setError("Sign up requires an invite link from an admin.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const supabase = getBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
      const { error: err } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectTo },
      });
      if (err) {
        setError(err.message);
        return;
      }
      setError("Check your email to confirm, then sign in.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fbfd_0%,_#e8eef2_45%,_#dfe7ec_100%)] px-4 py-8 sm:px-6 sm:py-10">
      <div className="mx-auto grid w-full max-w-5xl gap-6 lg:grid-cols-5">
        <section className="neo-card overflow-hidden lg:col-span-2 p-0">
          <div className="bg-[var(--brand-dark)] px-6 py-5 text-white sm:px-8">
            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-base font-semibold tracking-wide shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]">
                WO
              </div>
              <div>
                <p className="text-lg font-semibold leading-tight">WoodOps</p>
                <p className="text-xs text-white/70">Atelier Pelissier Operations</p>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
          <div className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--foreground)]">Welcome back</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--foreground-muted)]">
              Keep your projects, service calls, and production planning in one operational source of truth.
            </p>
          </div>

          <div className="space-y-3 text-sm text-[var(--foreground-muted)]">
            <p className="font-medium text-[var(--foreground)]">Inside your workspace</p>
            <ul className="space-y-2">
              <li>• Plan service calls and calendar commitments</li>
              <li>• Track project costs and production operations</li>
              <li>• Coordinate team actions through AI approvals</li>
            </ul>
          </div>

          <div className="mt-6 rounded-xl border border-white/60 bg-white/55 p-4 text-xs text-[var(--foreground-muted)] shadow-sm">
            Internal platform access is controlled by role invitations. If you are new, request an invite from an admin.
          </div>
          </div>
        </section>

        <section className="neo-card lg:col-span-3 p-6 sm:p-8">
          <div className="mb-5">
            <h2 className="text-2xl font-semibold text-[var(--foreground)]">Sign in</h2>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Continue to your workspace and operations dashboard.
            </p>
          </div>

          {invite && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Invite detected. Use the invited email, then click <strong>Sign up with this email</strong>.
            </div>
          )}

          <form onSubmit={signIn} className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Email</label>
              <input
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neo-input w-full px-4 py-2.5 text-sm"
                placeholder="you@company.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">Password</label>
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neo-input w-full px-4 py-2.5 text-sm"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="neo-btn-primary w-full py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>

            <p className="text-center text-xs text-[var(--foreground-muted)]">
              Secure access powered by Supabase Auth
            </p>
          </form>

          {invite && (
            <div className="mt-6 border-t border-black/10 pt-5">
              <p className="mb-3 text-sm text-[var(--foreground-muted)]">
                First time here with this invite?
              </p>
              <button
                type="button"
                onClick={signUp}
                disabled={loading}
                className="neo-btn w-full py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? "Please wait..." : "Sign up with this email"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-400">
          Loading…
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

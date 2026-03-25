"use client";

import { useState } from "react";
import Link from "next/link";
import { APP_ROLES } from "@/lib/auth/roles";

export default function AdminInvitesPage() {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("woodworker");
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInviteUrl(null);
    setLoading(true);
    try {
      const res = await fetch("/api/admin/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), role }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed");
        return;
      }
      setInviteUrl(data.inviteUrl as string);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-4">
      <div>
        <Link href="/admin" className="text-sm text-amber-700 hover:underline">
          ← Admin Hub
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Team invites</h1>
        <p className="text-sm text-[var(--foreground-muted)]">
          Create an invite for an email address. The person signs up with that email using the invite link (valid 7 days).
        </p>
      </div>
      <form onSubmit={submit} className="neo-card space-y-4 p-6">
        <div>
          <label className="mb-1 block text-sm font-medium">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="neo-input w-full px-3 py-2"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="neo-input w-full px-3 py-2"
          >
            {APP_ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="neo-btn-primary w-full py-2">
          {loading ? "Creating…" : "Create invite"}
        </button>
      </form>
      {inviteUrl && (
        <div className="neo-card p-4 text-sm">
          <p className="mb-2 font-medium">Share this link:</p>
          <code className="block break-all rounded bg-black/5 p-2 text-xs">{inviteUrl}</code>
        </div>
      )}
    </div>
  );
}

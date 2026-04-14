"use client";

import { useEffect, useState } from "react";
import type { AppRole } from "@/lib/auth/roles";

export type CurrentUser = {
  id: string;
  email: string | null;
  name: string | null;
  role: AppRole;
  realRole?: AppRole;
  impersonation?: { role: AppRole } | null;
  onboardingComplete: boolean;
  employeeId?: string | null;
};

type State = {
  user: CurrentUser | null;
  loading: boolean;
};

// Shared singleton cache so multiple components don't refetch.
let cached: CurrentUser | null = null;
let inFlight: Promise<CurrentUser | null> | null = null;

async function fetchMe(): Promise<CurrentUser | null> {
  if (cached) return cached;
  if (inFlight) return inFlight;
  inFlight = fetch("/api/auth/me")
    .then((r) => (r.ok ? r.json() : null))
    .then((data) => {
      const u = data?.user ?? null;
      cached = u;
      return u;
    })
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/**
 * Returns the current user (including effective role) from `/api/auth/me`.
 * Shared module-level cache — safe to call from multiple components without
 * duplicating network requests.
 */
export function useCurrentUser(): State {
  const [user, setUser] = useState<CurrentUser | null>(cached);
  const [loading, setLoading] = useState<boolean>(!cached);

  useEffect(() => {
    let alive = true;
    if (cached) {
      setUser(cached);
      setLoading(false);
      return;
    }
    fetchMe().then((u) => {
      if (!alive) return;
      setUser(u);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading };
}

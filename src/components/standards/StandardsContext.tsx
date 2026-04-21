"use client";

/**
 * StandardsContext — provides shop standards + this project's overrides to
 * the builders, one fetch per project mount.
 *
 * Rationale
 * ──────────
 * Every builder (kitchen, vanity, side-unit) reads a LOT of the same
 * values: kitchenBaseHeight, vanityDepthStandard, panelThickness, etc.
 * Each of those can be overridden on a specific project, and the UI has
 * to render three states per field:
 *
 *   1. "Standard — 34.75 in"   (no override)
 *   2. "Override pending — 35 in, awaiting admin review"
 *   3. "Override approved — 35 in"
 *
 * If each <ConstructionStandardField /> fetched both the standards row and
 * the overrides list independently we'd end up with dozens of HTTP calls
 * per builder mount. This context loads both once and hands every field a
 * typed `useResolvedStandard(key)` resolver.
 *
 * Usage
 * ─────
 *   <StandardsProvider projectId={projectId}>
 *     <ConstructionStandardField standardKey="kitchenBaseHeight" />
 *   </StandardsProvider>
 *
 * If `projectId` is null (e.g. a brand-new draft with no id yet), the
 * provider still loads shop standards but treats the overrides list as
 * empty — fields render in "no override" state, and editing them triggers
 * "Save draft first to request overrides".
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  CABINET_DEFAULTS,
  type ConstructionStandardsData,
} from "@/lib/ingredients/types";
import {
  resolveStandard,
  type ResolvedStandard,
  type StandardKey,
  type StandardsOverrideDTO,
} from "./overrideResolver";

// Re-export for consumers importing from the context module directly.
export type { ResolvedStandard, StandardKey, StandardsOverrideDTO };

// ── Context shape ──────────────────────────────────────────────────────

type StandardsContextValue = {
  projectId: string | null;
  loading: boolean;
  standards: ConstructionStandardsData;
  overrides: StandardsOverrideDTO[];
  /**
   * Resolve a single standard to its effective reading. Accepts an optional
   * `sectionId` for per-cabinet overrides; when omitted the resolver only
   * considers project-level overrides (sectionId === null).
   */
  resolve: (key: StandardKey, sectionId?: string | null) => ResolvedStandard;
  /**
   * Request an override. Returns the created row on success, or throws.
   * The caller is responsible for UI (modal, toast, optimistic add).
   */
  requestOverride: (args: {
    standardKey: StandardKey;
    overrideValue: number;
    sectionId?: string | null;
    reason?: string | null;
  }) => Promise<StandardsOverrideDTO>;
  /** Re-fetch overrides (e.g. after approval elsewhere). */
  refresh: () => Promise<void>;
};

const StandardsContext = createContext<StandardsContextValue | null>(null);

// ── Provider ───────────────────────────────────────────────────────────

export function StandardsProvider({
  projectId,
  children,
}: {
  projectId: string | null;
  children: ReactNode;
}) {
  const [standards, setStandards] = useState<ConstructionStandardsData>(CABINET_DEFAULTS);
  const [overrides, setOverrides] = useState<StandardsOverrideDTO[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      // Shop standards come from the admin-tuned row; overrides are project-
      // scoped. Either fetch can 404/fail and we still render sensibly:
      // standards fall back to CABINET_DEFAULTS, overrides fall back to [].
      const [stdRes, ovrRes] = await Promise.all([
        fetch("/api/admin/construction-standards").catch(() => null),
        projectId
          ? fetch(`/api/projects/${projectId}/standards-overrides`).catch(() => null)
          : Promise.resolve(null),
      ]);

      if (stdRes && stdRes.ok) {
        const data = (await stdRes.json()) as Partial<ConstructionStandardsData>;
        setStandards({ ...CABINET_DEFAULTS, ...data });
      }
      if (ovrRes && ovrRes.ok) {
        const data = (await ovrRes.json()) as StandardsOverrideDTO[];
        setOverrides(Array.isArray(data) ? data : []);
      } else {
        setOverrides([]);
      }
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    load();
  }, [load]);

  const resolve = useCallback<StandardsContextValue["resolve"]>(
    (key, sectionId = null) => resolveStandard(standards, overrides, key, sectionId),
    [standards, overrides]
  );

  const requestOverride = useCallback<StandardsContextValue["requestOverride"]>(
    async ({ standardKey, overrideValue, sectionId = null, reason = null }) => {
      if (!projectId) {
        throw new Error("Save the draft first before requesting overrides.");
      }
      const res = await fetch(`/api/projects/${projectId}/standards-overrides`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ standardKey, overrideValue, sectionId, reason }),
      });
      if (!res.ok) {
        const { error } = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(error ?? "Override request failed");
      }
      const created = (await res.json()) as StandardsOverrideDTO;
      setOverrides((prev) => [created, ...prev]);
      return created;
    },
    [projectId]
  );

  const value = useMemo<StandardsContextValue>(
    () => ({
      projectId,
      loading,
      standards,
      overrides,
      resolve,
      requestOverride,
      refresh: load,
    }),
    [projectId, loading, standards, overrides, resolve, requestOverride, load]
  );

  return <StandardsContext.Provider value={value}>{children}</StandardsContext.Provider>;
}

// ── Hooks ──────────────────────────────────────────────────────────────

export function useStandardsContext(): StandardsContextValue {
  const ctx = useContext(StandardsContext);
  if (!ctx) {
    throw new Error("useStandardsContext must be used inside <StandardsProvider>");
  }
  return ctx;
}

/** Convenience hook to resolve a single standard. */
export function useResolvedStandard(
  key: StandardKey,
  sectionId?: string | null
): ResolvedStandard {
  const { resolve } = useStandardsContext();
  return resolve(key, sectionId);
}

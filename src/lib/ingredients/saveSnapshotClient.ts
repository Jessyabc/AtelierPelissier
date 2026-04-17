/**
 * Client-side helper to persist a material snapshot for a project.
 *
 * Kept as a tiny standalone module so VanityTab, SideUnitTab, and
 * IngredientEstimatePanel can all trigger the same POST without duplicating
 * fetch boilerplate. The response body intentionally mirrors what
 * /api/projects/[id]/material-snapshot returns.
 */

export type MaterialSnapshotSaveResult = {
  snapshotId?: string;
  ok: boolean;
  error?: string;
};

export async function saveMaterialSnapshot(
  projectId: string,
  sourceType: "vanity" | "side_unit"
): Promise<MaterialSnapshotSaveResult> {
  try {
    const res = await fetch(`/api/projects/${projectId}/material-snapshot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceType }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: data?.error ?? `HTTP ${res.status}` };
    }
    return { ok: true, snapshotId: data?.snapshotId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Network error",
    };
  }
}

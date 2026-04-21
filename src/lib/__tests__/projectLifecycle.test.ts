import {
  DEFAULT_FOLLOWUP_THRESHOLDS,
  daysSinceLastSalesActivity,
  effectiveLastSalesActivity,
  getSalesFollowUpReason,
  isSalesFollowUpCandidate,
  shouldAutoArchive,
  thresholdsFromStandards,
} from "@/lib/projectLifecycle";

// ── Fixtures ─────────────────────────────────────────────────────────

/** Fixed "now" so day math is deterministic. */
const NOW = new Date("2026-04-17T12:00:00Z");

function daysAgo(n: number): Date {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000);
}

/** A pristine quote — never touched since creation. */
function quote(overrides: Parameters<typeof getSalesFollowUpReason>[0] = {}) {
  return {
    stage: "quote",
    isDraft: true,
    isDone: false,
    lastSalesActivityAt: daysAgo(0),
    updatedAt: daysAgo(0),
    ...overrides,
  };
}

// ── effectiveLastSalesActivity ───────────────────────────────────────

describe("effectiveLastSalesActivity", () => {
  it("prefers lastSalesActivityAt when present", () => {
    const sales = daysAgo(5);
    const updated = daysAgo(1);
    const res = effectiveLastSalesActivity({
      lastSalesActivityAt: sales,
      updatedAt: updated,
    });
    expect(res?.toISOString()).toBe(sales.toISOString());
  });

  it("falls back to updatedAt when lastSalesActivityAt is null", () => {
    const updated = daysAgo(3);
    const res = effectiveLastSalesActivity({ updatedAt: updated, lastSalesActivityAt: null });
    expect(res?.toISOString()).toBe(updated.toISOString());
  });

  it("returns null when neither timestamp is present", () => {
    expect(effectiveLastSalesActivity({})).toBeNull();
  });

  it("handles ISO strings from JSON payloads", () => {
    const iso = daysAgo(2).toISOString();
    const res = effectiveLastSalesActivity({ lastSalesActivityAt: iso });
    expect(res?.toISOString()).toBe(iso);
  });
});

// ── isSalesFollowUpCandidate ─────────────────────────────────────────

describe("isSalesFollowUpCandidate", () => {
  it("true for quotes", () => {
    expect(isSalesFollowUpCandidate({ stage: "quote", isDraft: true })).toBe(true);
  });

  it("true for draft projects (invoiced, no deposit)", () => {
    expect(isSalesFollowUpCandidate({ stage: "invoiced", isDraft: true })).toBe(true);
  });

  it("false for active projects (deposit received)", () => {
    expect(
      isSalesFollowUpCandidate({ stage: "confirmed", depositReceivedAt: daysAgo(1) })
    ).toBe(false);
  });

  it("false for completed projects", () => {
    expect(isSalesFollowUpCandidate({ stage: "confirmed", isDone: true })).toBe(false);
  });

  it("false for archived quotes", () => {
    expect(
      isSalesFollowUpCandidate({ stage: "quote", archivedAt: daysAgo(1) })
    ).toBe(false);
  });

  it("false for lost quotes", () => {
    expect(
      isSalesFollowUpCandidate({ stage: "quote", lostReason: "Went with competitor" })
    ).toBe(false);
  });
});

// ── getSalesFollowUpReason ───────────────────────────────────────────

describe("getSalesFollowUpReason", () => {
  it("returns null for fresh quotes under threshold", () => {
    expect(
      getSalesFollowUpReason(quote({ lastSalesActivityAt: daysAgo(3) }), NOW)
    ).toBeNull();
  });

  it("triggers at exactly the quote threshold (14 days)", () => {
    const reason = getSalesFollowUpReason(
      quote({ lastSalesActivityAt: daysAgo(14) }),
      NOW
    );
    expect(reason).not.toBeNull();
    expect(reason!.view).toBe("quote");
    expect(reason!.daysSinceActivity).toBe(14);
    expect(reason!.thresholdDays).toBe(14);
    expect(reason!.label).toBe("Follow up on quote — 14 days quiet");
  });

  it("triggers past the threshold and reports day count", () => {
    const reason = getSalesFollowUpReason(
      quote({ lastSalesActivityAt: daysAgo(21) }),
      NOW
    );
    expect(reason?.daysSinceActivity).toBe(21);
    expect(reason?.label).toBe("Follow up on quote — 21 days quiet");
  });

  it("uses the invoice threshold (7 days) for draft projects", () => {
    const reason = getSalesFollowUpReason(
      {
        stage: "invoiced",
        isDraft: true,
        lastSalesActivityAt: daysAgo(7),
      },
      NOW
    );
    expect(reason).not.toBeNull();
    expect(reason!.view).toBe("draft_project");
    expect(reason!.thresholdDays).toBe(7);
    expect(reason!.label).toBe("Chase deposit — 7 days since invoice activity");
  });

  it("handles the singular-day edge (1 day)", () => {
    const custom = { ...DEFAULT_FOLLOWUP_THRESHOLDS, quoteFollowUpDays: 1 };
    const reason = getSalesFollowUpReason(
      quote({ lastSalesActivityAt: daysAgo(1) }),
      NOW,
      custom
    );
    expect(reason?.label).toBe("Follow up on quote — 1 day quiet");
  });

  it("returns null for archived quotes even if quiet for years", () => {
    const reason = getSalesFollowUpReason(
      {
        stage: "quote",
        isDraft: true,
        archivedAt: daysAgo(30),
        lastSalesActivityAt: daysAgo(365),
      },
      NOW
    );
    expect(reason).toBeNull();
  });

  it("respects custom thresholds", () => {
    const custom = { ...DEFAULT_FOLLOWUP_THRESHOLDS, quoteFollowUpDays: 30 };
    expect(
      getSalesFollowUpReason(quote({ lastSalesActivityAt: daysAgo(20) }), NOW, custom)
    ).toBeNull();
    expect(
      getSalesFollowUpReason(quote({ lastSalesActivityAt: daysAgo(31) }), NOW, custom)
    ).not.toBeNull();
  });
});

// ── shouldAutoArchive ────────────────────────────────────────────────

describe("shouldAutoArchive", () => {
  it("false for fresh quotes", () => {
    expect(shouldAutoArchive(quote({ lastSalesActivityAt: daysAgo(3) }), NOW)).toBe(false);
  });

  it("false at the follow-up threshold (14 days — only nudge, don't archive)", () => {
    expect(shouldAutoArchive(quote({ lastSalesActivityAt: daysAgo(14) }), NOW)).toBe(false);
  });

  it("true at the archive threshold (28 days default)", () => {
    expect(shouldAutoArchive(quote({ lastSalesActivityAt: daysAgo(28) }), NOW)).toBe(true);
  });

  it("true well past the archive threshold", () => {
    expect(shouldAutoArchive(quote({ lastSalesActivityAt: daysAgo(60) }), NOW)).toBe(true);
  });

  it("NEVER auto-archives invoiced/draft projects, even if very stale", () => {
    expect(
      shouldAutoArchive(
        { stage: "invoiced", isDraft: true, lastSalesActivityAt: daysAgo(365) },
        NOW
      )
    ).toBe(false);
  });

  it("false for already archived quotes", () => {
    expect(
      shouldAutoArchive(
        {
          stage: "quote",
          isDraft: true,
          archivedAt: daysAgo(1),
          lastSalesActivityAt: daysAgo(60),
        },
        NOW
      )
    ).toBe(false);
  });

  it("false for lost quotes", () => {
    expect(
      shouldAutoArchive(
        {
          stage: "quote",
          isDraft: true,
          lostReason: "Budget fell through",
          lastSalesActivityAt: daysAgo(60),
        },
        NOW
      )
    ).toBe(false);
  });

  it("false when activity timestamp is missing (no sweep on unknown state)", () => {
    expect(
      shouldAutoArchive({ stage: "quote", isDraft: true }, NOW)
    ).toBe(false);
  });
});

// ── daysSinceLastSalesActivity ───────────────────────────────────────

describe("daysSinceLastSalesActivity", () => {
  it("returns day count for active projects", () => {
    expect(
      daysSinceLastSalesActivity({ lastSalesActivityAt: daysAgo(5) }, NOW)
    ).toBe(5);
  });

  it("returns null when no timestamp is available", () => {
    expect(daysSinceLastSalesActivity({}, NOW)).toBeNull();
  });

  it("clamps negative (future) values to 0", () => {
    const future = new Date(NOW.getTime() + 48 * 60 * 60 * 1000);
    expect(
      daysSinceLastSalesActivity({ lastSalesActivityAt: future }, NOW)
    ).toBe(0);
  });
});

// ── thresholdsFromStandards ──────────────────────────────────────────

describe("thresholdsFromStandards", () => {
  it("passes quote / invoice days through unchanged", () => {
    const t = thresholdsFromStandards({
      quoteFollowUpDays: 10,
      invoiceFollowUpDays: 5,
    });
    expect(t.quoteFollowUpDays).toBe(10);
    expect(t.invoiceFollowUpDays).toBe(5);
  });

  it("derives quoteArchiveAfterDays as 2× quoteFollowUpDays", () => {
    const t = thresholdsFromStandards({
      quoteFollowUpDays: 10,
      invoiceFollowUpDays: 5,
    });
    expect(t.quoteArchiveAfterDays).toBe(20);
  });

  it("uses standards defaults to match DEFAULT_FOLLOWUP_THRESHOLDS", () => {
    const t = thresholdsFromStandards({
      quoteFollowUpDays: DEFAULT_FOLLOWUP_THRESHOLDS.quoteFollowUpDays,
      invoiceFollowUpDays: DEFAULT_FOLLOWUP_THRESHOLDS.invoiceFollowUpDays,
    });
    expect(t).toEqual(DEFAULT_FOLLOWUP_THRESHOLDS);
  });
});

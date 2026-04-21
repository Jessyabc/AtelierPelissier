import {
  getStageView,
  getStageLabel,
  getStageShortLabel,
  isQuote,
  isDraftProject,
  isActiveProject,
  isSalesOwned,
  isHiddenByDefault,
  getNewItemLabels,
} from "@/lib/projectStage";

describe("projectStage — getStageView", () => {
  it("returns 'quote' for stage=quote with no deposit", () => {
    expect(getStageView({ stage: "quote" })).toBe("quote");
  });

  it("returns 'draft_project' for stage=invoiced with no deposit", () => {
    expect(getStageView({ stage: "invoiced" })).toBe("draft_project");
  });

  it("returns 'project' for stage=confirmed", () => {
    expect(getStageView({ stage: "confirmed" })).toBe("project");
  });

  it("returns 'project' when a deposit landed even if stage still says invoiced", () => {
    expect(
      getStageView({ stage: "invoiced", depositReceivedAt: "2026-04-17" })
    ).toBe("project");
  });

  it("returns 'completed' when isDone is set, regardless of stage", () => {
    expect(getStageView({ stage: "quote", isDone: true })).toBe("completed");
  });

  it("returns 'archived_quote' when archivedAt is set", () => {
    expect(
      getStageView({ stage: "quote", archivedAt: "2026-04-01" })
    ).toBe("archived_quote");
  });

  it("returns 'lost_quote' when lostReason is set (overrides archived)", () => {
    expect(
      getStageView({ stage: "quote", archivedAt: "2026-04-01", lostReason: "went elsewhere" })
    ).toBe("lost_quote");
  });

  it("falls back to 'quote' when only legacy isDraft is set and stage is missing", () => {
    expect(getStageView({ isDraft: true })).toBe("quote");
  });

  it("falls back to 'project' when nothing is set (legacy confirmed default)", () => {
    expect(getStageView({})).toBe("project");
  });
});

describe("projectStage — labels", () => {
  it("getStageLabel returns expected short labels", () => {
    expect(getStageLabel("quote").short).toBe("Quote");
    expect(getStageLabel("draft_project").short).toBe("Draft project");
    expect(getStageLabel("project").short).toBe("Project");
    expect(getStageLabel("completed").short).toBe("Completed");
    expect(getStageLabel("archived_quote").short).toBe("Archived");
    expect(getStageLabel("lost_quote").short).toBe("Lost");
  });

  it("getStageShortLabel resolves through getStageView", () => {
    expect(getStageShortLabel({ stage: "invoiced" })).toBe("Draft project");
  });
});

describe("projectStage — predicates", () => {
  it("isQuote / isDraftProject / isActiveProject are mutually exclusive on a single project", () => {
    const p = { stage: "quote" };
    expect([isQuote(p), isDraftProject(p), isActiveProject(p)].filter(Boolean)).toHaveLength(1);
  });

  it("isSalesOwned is true for quote and draft_project, false otherwise", () => {
    expect(isSalesOwned({ stage: "quote" })).toBe(true);
    expect(isSalesOwned({ stage: "invoiced" })).toBe(true);
    expect(isSalesOwned({ stage: "confirmed" })).toBe(false);
    expect(isSalesOwned({ isDone: true })).toBe(false);
  });

  it("isHiddenByDefault flags archived and lost quotes only", () => {
    expect(isHiddenByDefault({ stage: "quote", archivedAt: "2026-01-01" })).toBe(true);
    expect(isHiddenByDefault({ stage: "quote", lostReason: "x" })).toBe(true);
    expect(isHiddenByDefault({ stage: "quote" })).toBe(false);
  });
});

describe("projectStage — getNewItemLabels", () => {
  it("returns 'New quote' for salespeople", () => {
    expect(getNewItemLabels("salesperson")).toEqual({
      menu: "New quote",
      cta: "Start a new quote",
    });
  });

  it("returns 'New project' for planners, admins, woodworkers, unknown", () => {
    expect(getNewItemLabels("planner").menu).toBe("New project");
    expect(getNewItemLabels("admin").menu).toBe("New project");
    expect(getNewItemLabels("woodworker").menu).toBe("New project");
    expect(getNewItemLabels(null).menu).toBe("New project");
  });
});

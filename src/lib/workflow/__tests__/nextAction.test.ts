import { getNextAction, type NextActionProject } from "../nextAction";

function base(overrides: Partial<NextActionProject> = {}): NextActionProject {
  return {
    id: "p1",
    isDraft: true,
    isDone: false,
    stage: "confirmed",
    depositReceivedAt: null,
    clientId: null,
    clientFirstName: null,
    clientLastName: null,
    projectItems: [],
    costLines: [],
    sellingPrice: null,
    targetDate: null,
    blockedReason: null,
    hasMaterialSnapshot: false,
    hasStaleMaterialSnapshot: false,
    ...overrides,
  };
}

describe("getNextAction", () => {
  describe("done projects", () => {
    it("returns terminal view action regardless of role", () => {
      const p = base({ isDone: true, isDraft: false });
      for (const role of ["salesperson", "planner", "admin", "woodworker"] as const) {
        const a = getNextAction(p, role);
        expect(a.terminal).toBe(true);
        expect(a.label).toBe("View project");
      }
    });
  });

  describe("salesperson story", () => {
    it("asks for client first", () => {
      const a = getNextAction(base(), "salesperson");
      expect(a.label).toBe("Add client");
      expect(a.tone).toBe("primary");
    });

    it("asks for rooms after client", () => {
      const a = getNextAction(base({ clientId: "c1" }), "salesperson");
      expect(a.label).toBe("Add rooms");
    });

    it("asks to build estimate after rooms", () => {
      const a = getNextAction(
        base({ clientId: "c1", projectItems: [{ id: "r1" }] }),
        "salesperson"
      );
      expect(a.label).toBe("Build estimate");
    });

    it("asks to save after estimate on draft", () => {
      const a = getNextAction(
        base({
          clientId: "c1",
          projectItems: [{ id: "r1" }],
          sellingPrice: 1000,
        }),
        "salesperson"
      );
      expect(a.label).toBe("Save project");
    });

    it("hands off to shop once confirmed and saved", () => {
      const a = getNextAction(
        base({
          isDraft: false,
          stage: "confirmed",
          clientId: "c1",
          projectItems: [{ id: "r1" }],
          sellingPrice: 1000,
        }),
        "salesperson"
      );
      expect(a.label).toBe("Hand off to shop");
      expect(a.tone).toBe("success");
    });

    it("asks to send quote when stage is quick-quote", () => {
      const a = getNextAction(
        base({
          stage: "quote",
          clientId: "c1",
          projectItems: [{ id: "r1" }],
          sellingPrice: 1000,
        }),
        "salesperson"
      );
      expect(a.label).toBe("Send quote");
    });

    it("asks to confirm deposit when stage is invoiced", () => {
      const a = getNextAction(
        base({
          stage: "invoiced",
          clientId: "c1",
          projectItems: [{ id: "r1" }],
          sellingPrice: 1000,
        }),
        "salesperson"
      );
      expect(a.label).toBe("Confirm deposit");
      expect(a.tone).toBe("warning");
    });
  });

  describe("stage gates for planner", () => {
    it("waits on sales when stage is quote", () => {
      const a = getNextAction(
        base({ stage: "quote", projectItems: [{ id: "r1" }] }),
        "planner"
      );
      expect(a.label).toBe("Waiting on sales");
    });

    it("waits on deposit when stage is invoiced", () => {
      const a = getNextAction(
        base({ stage: "invoiced", projectItems: [{ id: "r1" }] }),
        "planner"
      );
      expect(a.label).toBe("Waiting on deposit");
    });
  });

  describe("planner story", () => {
    it("surfaces blocked reason first", () => {
      const a = getNextAction(base({ blockedReason: "missing_material" }), "planner");
      expect(a.label).toBe("Resolve block");
      expect(a.tone).toBe("warning");
    });

    it("asks to review intake when no rooms", () => {
      const a = getNextAction(base(), "planner");
      expect(a.label).toBe("Review intake");
    });

    it("asks to verify materials when rooms exist but no snapshot", () => {
      const a = getNextAction(base({ projectItems: [{ id: "r1" }] }), "planner");
      expect(a.label).toBe("Verify materials");
    });

    it("asks to regenerate when snapshot is stale", () => {
      const a = getNextAction(
        base({
          projectItems: [{ id: "r1" }],
          hasMaterialSnapshot: true,
          hasStaleMaterialSnapshot: true,
        }),
        "planner"
      );
      expect(a.label).toBe("Regenerate materials");
      expect(a.tone).toBe("warning");
    });

    it("asks to schedule after snapshot saved", () => {
      const a = getNextAction(
        base({
          isDraft: false,
          projectItems: [{ id: "r1" }],
          hasMaterialSnapshot: true,
        }),
        "planner"
      );
      expect(a.label).toBe("Schedule");
    });

    it("asks to release when everything is ready", () => {
      const a = getNextAction(
        base({
          isDraft: false,
          projectItems: [{ id: "r1" }],
          hasMaterialSnapshot: true,
          targetDate: new Date().toISOString(),
        }),
        "planner"
      );
      expect(a.label).toBe("Release to shop");
    });
  });

  describe("woodworker story", () => {
    it("always points to build sheet", () => {
      const a = getNextAction(base({ projectItems: [{ id: "r1" }] }), "woodworker");
      expect(a.label).toBe("Open build sheet");
      expect(a.href).toContain("tab=Production");
    });
  });
});

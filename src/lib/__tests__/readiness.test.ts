import { computeReadinessCheck } from "@/lib/readiness";

const base = {
  jobNumber: "MC-1",
  clientId: "clxxx",
  clientFirstName: null as string | null,
  clientLastName: null as string | null,
  targetDate: new Date("2026-06-01"),
  projectItemCount: 1,
};

describe("computeReadinessCheck", () => {
  it("passes when all requirements met (client via id)", () => {
    expect(computeReadinessCheck(base)).toEqual({ ready: true, missing: [] });
  });

  it("passes when client via embedded names", () => {
    expect(
      computeReadinessCheck({
        ...base,
        clientId: null,
        clientFirstName: "A",
        clientLastName: "B",
      })
    ).toEqual({ ready: true, missing: [] });
  });

  it("fails without jobNumber", () => {
    const r = computeReadinessCheck({ ...base, jobNumber: "" });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("jobNumber");
  });

  it("fails without client", () => {
    const r = computeReadinessCheck({
      ...base,
      clientId: null,
      clientFirstName: "",
      clientLastName: "",
    });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("client");
  });

  it("fails without targetDate", () => {
    const r = computeReadinessCheck({ ...base, targetDate: null });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("targetDate");
  });

  it("fails without project items", () => {
    const r = computeReadinessCheck({ ...base, projectItemCount: 0 });
    expect(r.ready).toBe(false);
    expect(r.missing).toContain("projectItems");
  });
});

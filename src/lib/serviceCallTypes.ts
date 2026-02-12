/** Technician checklist keys (matches PDF form) */
export const CHECKLIST_KEYS = [
  { key: "workIdentified", label: "Issue fully identified" },
  { key: "repairCompleted", label: "Repair / adjustment completed" },
  { key: "workTested", label: "Work tested and verified" },
  { key: "componentsSecured", label: "All components secured and functional" },
  { key: "resultShown", label: "Final result shown to the client" },
  { key: "problemExplained", label: "Problem explained to the client" },
  { key: "solutionExplained", label: "Solution explained clearly" },
  { key: "recommendationsGiven", label: "Maintenance or usage recommendations given" },
  { key: "questionsAnswered", label: "Client questions answered" },
  { key: "workAreaCleaned", label: "Work area cleaned" },
  { key: "debrisRemoved", label: "Dust, debris, packaging removed" },
  { key: "furnitureReturned", label: "Furniture / equipment returned to original position" },
  { key: "noDamage", label: "No damage to surrounding areas" },
  { key: "clientPresent", label: "Client present for final walkthrough" },
  { key: "workApproved", label: "Client approved completed work" },
  { key: "formCompleted", label: "Client satisfaction form completed" },
  { key: "signatureObtained", label: "Client signature obtained" },
] as const;

export const SATISFACTION_CRITERIA = [
  { key: "quality", label: "Quality of Work" },
  { key: "timeliness", label: "Timeliness" },
  { key: "professionalism", label: "Professionalism" },
  { key: "communication", label: "Communication" },
  { key: "overall", label: "Overall Satisfaction" },
] as const;

export const SATISFACTION_LEVELS = ["poor", "fair", "good", "excellent"] as const;

export const SERVICE_CALL_TYPES = [
  "warranty",
  "repair",
  "adjustment",
  "inspection",
  "installation",
  "measurements", // Measurements appointment
  "other",
] as const;

export type ServiceCallType = (typeof SERVICE_CALL_TYPES)[number];

export function parseServiceCallTypesJson(json: string | null): ServiceCallType[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed.filter((t): t is ServiceCallType =>
        typeof t === "string" && SERVICE_CALL_TYPES.includes(t as ServiceCallType)
      );
    }
    // Legacy: single string (e.g. "warranty")
    if (typeof parsed === "string" && SERVICE_CALL_TYPES.includes(parsed as ServiceCallType)) {
      return [parsed as ServiceCallType];
    }
    return [];
  } catch {
    // Legacy: plain string stored directly (no JSON)
    if (SERVICE_CALL_TYPES.includes(json as ServiceCallType)) {
      return [json as ServiceCallType];
    }
    return [];
  }
}

export function stringifyServiceCallTypes(types: ServiceCallType[]): string {
  return JSON.stringify(types);
}

export function parseChecklistJson(json: string | null): Record<string, boolean> {
  if (!json?.trim()) return {};
  try {
    return JSON.parse(json) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function stringifyChecklist(obj: Record<string, boolean>): string {
  return JSON.stringify(obj);
}

export function parseSatisfactionJson(json: string | null): Record<string, string> {
  if (!json?.trim()) return {};
  try {
    return JSON.parse(json) as Record<string, string>;
  } catch {
    return {};
  }
}

export function stringifySatisfaction(obj: Record<string, string>): string {
  return JSON.stringify(obj);
}

/** One reason item: description + service type */
export type ReasonForServiceItem = {
  description: string;
  serviceType: ServiceCallType | null;
};

/** Reasons for service call — one item per service needed, each with optional type */
export function parseReasonsForServiceJson(json: string | null): ReasonForServiceItem[] {
  if (!json?.trim()) return [];
  try {
    const parsed = JSON.parse(json);
    if (Array.isArray(parsed)) {
      return parsed
        .map((x): ReasonForServiceItem | null => {
          if (typeof x === "string" && x.trim()) {
            return { description: x.trim(), serviceType: null };
          }
          if (x && typeof x === "object" && "description" in x && typeof (x as ReasonForServiceItem).description === "string") {
            const desc = ((x as ReasonForServiceItem).description ?? "").trim();
            if (!desc) return null;
            const t = (x as ReasonForServiceItem).serviceType;
            return {
              description: desc,
              serviceType: t && SERVICE_CALL_TYPES.includes(t as ServiceCallType) ? (t as ServiceCallType) : null,
            };
          }
          return null;
        })
        .filter((x): x is ReasonForServiceItem => x !== null);
    }
    if (typeof parsed === "string" && parsed.trim()) return [{ description: parsed.trim(), serviceType: null }];
    return [];
  } catch {
    if (typeof json === "string" && json.trim()) return [{ description: json.trim(), serviceType: null }];
    return [];
  }
}

export function stringifyReasonsForService(reasons: ReasonForServiceItem[]): string {
  return JSON.stringify(reasons.filter((r) => r.description.trim()));
}

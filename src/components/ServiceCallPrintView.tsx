"use client";

import { CHECKLIST_KEYS, SATISFACTION_CRITERIA, parseChecklistJson, parseReasonsForServiceJson, parseSatisfactionJson, parseServiceCallTypesJson } from "@/lib/serviceCallTypes";

type ItemFile = { id: string; fileName: string; storagePath: string };
type Item = { id?: string; description: string; quantity?: string | null; providedBy?: string | null; files?: ItemFile[] };

type Props = {
  clientName?: string | null;
  jobNumber?: string | null;
  address?: string | null;
  contactPerson?: string | null;
  clientPhone?: string | null;
  clientEmail?: string | null;
  serviceDate?: string | null;
  timeOfArrival?: string | null;
  timeOfDeparture?: string | null;
  technicianName?: string | null;
  serviceCallNumber?: string | null;
  serviceCallType?: string | null;
  reasonForService?: string | null;
  workPerformed?: string | null;
  checklistJson?: string | null;
  items?: Item[];
  serviceCompleted?: boolean | null;
  additionalVisitRequired?: boolean | null;
  additionalVisitReason?: string | null;
  estimatedFollowUpDate?: string | null;
  satisfactionJson?: string | null;
  clientAcknowledgmentType?: string | null;
  followUpReason?: string | null;
  clientSignature?: string | null;
  responsibleSignature?: string | null;
};

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleDateString("en-CA", { dateStyle: "medium" });
  } catch {
    return "—";
  }
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-CA", {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
}

/** Empty line for writing by hand when printed — used when field is not prefilled */
function FillableLine({ className = "" }: { className?: string }) {
  return <span className={`inline-block min-w-[7rem] border-b border-gray-400 ${className}`} aria-hidden />;
}

export function ServiceCallPrintView(props: Props) {
  const checklist = parseChecklistJson(props.checklistJson ?? null);
  const satisfaction = parseSatisfactionJson(props.satisfactionJson ?? null);
  const items = props.items ?? [];

  return (
    <div id="service-call-print" className="space-y-6 rounded-lg border border-gray-200 bg-white p-6 text-sm print:border-0 print:shadow-none">
      <h1 className="border-b border-gray-200 pb-2 text-lg font-bold text-gray-900">Service Call Report</h1>

      {/* Client Information */}
      <section>
        <h2 className="mb-2 font-semibold text-gray-800">Client information</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <p><span className="text-gray-600">Client name:</span> {props.clientName || "—"}</p>
          <p><span className="text-gray-600">Job number:</span> {props.jobNumber || "—"}</p>
          <p className="col-span-2"><span className="text-gray-600">Service address:</span> {props.address || "—"}</p>
          <p><span className="text-gray-600">Contact person:</span> {props.contactPerson || "—"}</p>
          <p><span className="text-gray-600">Phone:</span> {props.clientPhone || "—"}</p>
          <p className="col-span-2"><span className="text-gray-600">Email:</span> {props.clientEmail || "—"}</p>
        </div>
      </section>

      {/* Service Call Details */}
      <section>
        <h2 className="mb-2 font-semibold text-gray-800">Service call details</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          <p><span className="text-gray-600">Service date:</span> {formatDate(props.serviceDate)}</p>
          <p>
            <span className="text-gray-600">Arrival:</span>{" "}
            {formatDateTime(props.timeOfArrival) || <FillableLine />}
          </p>
          <p>
            <span className="text-gray-600">Departure:</span>{" "}
            {formatDateTime(props.timeOfDeparture) || <FillableLine />}
          </p>
          <p>
            <span className="text-gray-600">Technician(s):</span>{" "}
            {props.technicianName?.trim() ? props.technicianName : <FillableLine className="min-w-[10rem]" />}
          </p>
          <p><span className="text-gray-600">Service call #:</span> {props.serviceCallNumber || "—"}</p>
          <p>
            <span className="text-gray-600">Service type(s):</span>{" "}
            {(() => {
              const types = parseServiceCallTypesJson(props.serviceCallType ?? null);
              return types.length ? types.map((t) => t.charAt(0).toUpperCase() + t.slice(1)).join(", ") : "—";
            })()}
          </p>
        </div>
        {(() => {
          const reasons = parseReasonsForServiceJson(props.reasonForService ?? null);
          if (reasons.length === 0) return null;
          return (
            <div className="mt-2">
              <span className="text-gray-600">Reason(s):</span>
              <ul className="list-inside list-disc mt-1 space-y-0.5">
                {reasons.map((r, i) => (
                  <li key={i}>
                    {r.description}
                    {r.serviceType && ` — ${r.serviceType.charAt(0).toUpperCase() + r.serviceType.slice(1)}`}
                  </li>
                ))}
              </ul>
            </div>
          );
        })()}
        {props.workPerformed && (
          <p className="mt-2"><span className="text-gray-600">Work performed:</span> {props.workPerformed}</p>
        )}
      </section>

      {/* Technician Checklist */}
      <section>
        <h2 className="mb-2 font-semibold text-gray-800">Technician checklist</h2>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
          {CHECKLIST_KEYS.map(({ key, label }) => (
            <p key={key}>
              {checklist[key] ? "☑" : "☐"} {label}
            </p>
          ))}
        </div>
      </section>

      {/* Materials / Parts */}
      {items.length > 0 && (
        <section>
          <h2 className="mb-2 font-semibold text-gray-800">Materials / parts used</h2>
          <ul className="space-y-3 list-none pl-0">
            {items.map((item, i) => (
              <li key={i} className="border-b border-gray-100 pb-2 last:border-0 last:pb-0">
                <div className="font-medium text-gray-900">
                  {item.description}
                  {item.quantity && ` · Qty: ${item.quantity}`}
                  {item.providedBy && ` · ${item.providedBy}`}
                </div>
                {(item.files?.length ?? 0) > 0 && (
                  <div className="mt-1 ml-4 text-gray-600 text-xs">
                    <span className="font-medium">Files: </span>
                    {item.files!.map((f) => f.fileName).join(", ")}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Service Status */}
      <section>
        <h2 className="mb-2 font-semibold text-gray-800">Service status</h2>
        <p>Service completed: {props.serviceCompleted === true ? "Yes" : props.serviceCompleted === false ? "No" : "—"}</p>
        <p>Additional visit required: {props.additionalVisitRequired === true ? "Yes" : props.additionalVisitRequired === false ? "No" : "—"}</p>
        {props.additionalVisitReason && <p className="mt-1">If yes: {props.additionalVisitReason}</p>}
        {props.estimatedFollowUpDate && (
          <p>Estimated follow-up: {formatDate(props.estimatedFollowUpDate)}</p>
        )}
      </section>

      {/* Client Satisfaction */}
      <section>
        <h2 className="mb-2 font-semibold text-gray-800">Client satisfaction</h2>
        <div className="space-y-1">
          {SATISFACTION_CRITERIA.map(({ key, label }) => {
            const v = satisfaction[key];
            return <p key={key}>{label}: {v ? `${v.charAt(0).toUpperCase()}${v.slice(1)}` : "—"}</p>;
          })}
        </div>
        {props.clientAcknowledgmentType && (
          <p className="mt-2">
            Client acknowledgment: Option {props.clientAcknowledgmentType === "completed" ? "1" : "2"} –{" "}
            {props.clientAcknowledgmentType === "completed" ? "Service completed" : "Partial / follow-up required"}
          </p>
        )}
        {props.followUpReason && <p className="mt-1">Follow-up reason: {props.followUpReason}</p>}
      </section>

      {/* Signatures */}
      <section className="grid grid-cols-2 gap-6 border-t border-gray-200 pt-4">
        <div>
          <h2 className="mb-2 font-semibold text-gray-700">Client signature</h2>
          {props.clientSignature ? (
            <img
              src={props.clientSignature}
              alt="Client signature"
              className="h-16 w-full max-w-[180px] border-b border-gray-400 object-contain"
            />
          ) : (
            <div className="h-12 w-full max-w-[180px] border-b border-gray-400" />
          )}
        </div>
        <div>
          <h2 className="mb-2 font-semibold text-gray-700">Technician signature</h2>
          {props.responsibleSignature ? (
            <img
              src={props.responsibleSignature}
              alt="Technician signature"
              className="h-16 w-full max-w-[180px] border-b border-gray-400 object-contain"
            />
          ) : (
            <div className="h-12 w-full max-w-[180px] border-b border-gray-400" />
          )}
        </div>
      </section>

      <p className="text-xs text-gray-500">
        Atelier Pelissier · Service call · {new Date().toLocaleDateString("en-CA")}
      </p>
    </div>
  );
}

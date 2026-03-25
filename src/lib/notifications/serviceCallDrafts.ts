import type { Project, ServiceCall } from "@prisma/client";

export type ServiceCallNotificationDrafts = {
  /** mailto: link for team / client (plain text body) */
  teamEmailMailto: string;
  /** Optional second mailto for client-facing message */
  clientEmailMailto?: string;
  /** iCalendar (.ics) file content */
  icsContent: string;
  summary: string;
};

function escapeIcsText(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * Build branded mailto + ICS drafts for a scheduled service call (manual send until SMTP is wired).
 */
export function buildServiceCallNotificationDrafts(params: {
  companyName: string;
  project: Project;
  serviceCall: ServiceCall;
  /** ISO date YYYY-MM-DD */
  dateLabel: string;
  /** e.g. "14:30" or empty */
  timeLabel: string;
  /** Internal notify emails (comma-separated from env or passed) */
  notifyEmails: string[];
}): ServiceCallNotificationDrafts {
  const { companyName, project, serviceCall, dateLabel, timeLabel, notifyEmails } = params;

  const address = serviceCall.address ?? project.clientAddress ?? "";
  const clientLine = [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ") || "Client";
  const job = project.jobNumber ?? serviceCall.jobNumber ?? project.id.slice(0, 8);

  const subject = encodeURIComponent(
    `[${companyName}] Service — ${job} — ${dateLabel}${timeLabel ? ` ${timeLabel}` : ""}`
  );

  const bodyLines = [
    `${companyName} — Service call scheduled`,
    "",
    `Job: ${job}`,
    `Project: ${project.name}`,
    `Client: ${clientLine}`,
    `Address: ${address}`,
    `Date: ${dateLabel}${timeLabel ? ` @ ${timeLabel}` : ""}`,
    serviceCall.reasonForService ? `Reason: ${serviceCall.reasonForService}` : "",
    serviceCall.notes ? `Notes: ${serviceCall.notes}` : "",
    "",
    "— Sent from WoodOps",
  ].filter(Boolean);

  const teamTo = notifyEmails.filter(Boolean).join(",");
  const teamBody = encodeURIComponent(bodyLines.join("\n"));
  const teamEmailMailto = teamTo
    ? `mailto:${teamTo}?subject=${subject}&body=${teamBody}`
    : `mailto:?subject=${subject}&body=${teamBody}`;

  let clientEmailMailto: string | undefined;
  if (serviceCall.clientEmail?.trim()) {
    clientEmailMailto = `mailto:${serviceCall.clientEmail.trim()}?subject=${subject}&body=${teamBody}`;
  }

  const uid = `${serviceCall.id}@woodops`;
  const dtStamp = formatIcsUtc(new Date());
  const startD = serviceCall.serviceDate ?? new Date();
  const dateOnly = formatIcsDateOnly(startD);
  const endD = new Date(startD.getFullYear(), startD.getMonth(), startD.getDate() + 1);
  const dateEnd = formatIcsDateOnly(endD);

  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//WoodOps//Service Call//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;VALUE=DATE:${dateOnly}`,
    `DTEND;VALUE=DATE:${dateEnd}`,
    `SUMMARY:${escapeIcsText(`${companyName} — ${job} — ${project.name}`)}`,
    address ? `LOCATION:${escapeIcsText(address)}` : "",
    `DESCRIPTION:${escapeIcsText(bodyLines.join("\\n"))}`,
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");

  return {
    teamEmailMailto,
    clientEmailMailto,
    icsContent,
    summary: `Service scheduled for ${job} on ${dateLabel}${timeLabel ? ` at ${timeLabel}` : ""}`,
  };
}

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function formatIcsUtc(d: Date): string {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(
    d.getUTCMinutes()
  )}${pad(d.getUTCSeconds())}Z`;
}

function formatIcsDateOnly(d: Date): string {
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
}

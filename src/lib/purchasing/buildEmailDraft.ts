/**
 * Generates a mailto: URI with prefilled supplier order/reservation email.
 *
 * When called with a companyName parameter, uses that for the email sign-off.
 * Otherwise falls back to "Atelier Pelissier".
 */

export type EmailLineItem = {
  materialCode: string;
  description: string;
  quantity: number;
  unitCost: number;
  supplierSku: string;
};

export type EmailDraftParams = {
  supplierEmail: string | null;
  supplierName: string;
  orderType: "order" | "reserve";
  projectRef: string | null;
  items: EmailLineItem[];
  requestedDeliveryDate: string | null;
  notes?: string;
  companyName?: string;
};

export function buildEmailDraft(params: EmailDraftParams): {
  mailto: string;
  subject: string;
  body: string;
} {
  const { supplierEmail, supplierName, orderType, projectRef, items, requestedDeliveryDate, notes, companyName } = params;

  const signOff = companyName || "Atelier Pelissier";
  const typeLabel = orderType === "reserve" ? "Reservation" : "Order";
  const refPart = projectRef ? ` - ${projectRef}` : "";
  const materialSummary = items.length === 1
    ? items[0].description
    : `${items.length} items`;

  const subject = `${typeLabel}${refPart} - ${materialSummary}`;

  const lines: string[] = [];
  lines.push(`Hello ${supplierName} team,`);
  lines.push("");
  lines.push(
    orderType === "reserve"
      ? `We would like to reserve the following materials:`
      : `We would like to place an order for the following materials:`
  );
  lines.push("");

  for (const item of items) {
    const skuPart = item.supplierSku ? ` (SKU: ${item.supplierSku})` : "";
    const costPart = item.unitCost > 0 ? ` @ $${item.unitCost.toFixed(2)}/unit` : "";
    lines.push(`- ${item.quantity}x ${item.description}${skuPart}${costPart}`);
    lines.push(`  Material code: ${item.materialCode}`);
  }

  lines.push("");

  if (projectRef) {
    lines.push(`Reference: ${projectRef}`);
  }

  if (requestedDeliveryDate) {
    lines.push(`Requested delivery by: ${requestedDeliveryDate}`);
  }

  if (notes) {
    lines.push("");
    lines.push(`Notes: ${notes}`);
  }

  lines.push("");
  lines.push("Please confirm availability and expected delivery date.");
  lines.push("");
  lines.push("Thank you,");
  lines.push(signOff);

  const body = lines.join("\n");

  const to = supplierEmail ?? "";
  const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;

  return { mailto, subject, body };
}

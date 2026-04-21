import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { withAuth } from "@/lib/auth/guard";
import { formatCurrency } from "@/lib/format";
import React from "react";
import { renderToBuffer, Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

type Params = { id: string };

function safeName(name: string): string {
  return (name || "quote").replace(/[^\w\-]+/g, "_").slice(0, 80);
}

const styles = StyleSheet.create({
  page: { padding: 32, fontSize: 11, fontFamily: "Helvetica" },
  h1: { fontSize: 18, fontWeight: 700 },
  h2: { fontSize: 12, fontWeight: 700, marginTop: 18, marginBottom: 6 },
  muted: { color: "#6b7280" },
  row: { flexDirection: "row", justifyContent: "space-between" },
  table: { marginTop: 10, borderTopWidth: 1, borderTopColor: "#e5e7eb" },
  line: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: "#f3f4f6" },
});

export const GET = withAuth<Params>("any", async ({ params }) => {
  const { id } = params;
  const project = await prisma.project.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      jobNumber: true,
      targetDate: true,
      types: true,
      stage: true,
      sellingPrice: true,
      projectSettings: { select: { markup: true, taxEnabled: true, taxRate: true } },
      clientFirstName: true,
      clientLastName: true,
      clientEmail: true,
      clientPhone: true,
      clientPhone2: true,
      clientAddress: true,
      costLines: { select: { kind: true, category: true, amount: true } },
    },
  });
  if (!project) {
    return NextResponse.json({ error: "Project not found" }, { status: 404 });
  }

  const estimateLines = (project.costLines ?? []).filter((l) => l.kind === "estimate");
  const subtotal = estimateLines.reduce((s, l) => s + l.amount, 0);
  const settings = project.projectSettings;
  const markup = settings?.markup ?? 2.5;
  const afterMarkup = subtotal * markup;
  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0.14975) : 0;
  const tax = afterMarkup * taxRate;
  const computedTotal = afterMarkup + tax;
  const total = project.sellingPrice ?? computedTotal;

  const clientName =
    [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ").trim() || null;

  const today = new Date().toLocaleDateString("fr-CA");
  const filename = `quote_${safeName(project.name)}.pdf`;

  const el = React.createElement;

  const pdf = await renderToBuffer(
    el(
      Document,
      null,
      el(
        Page,
        { size: "LETTER", style: styles.page },
        el(
          View,
          { style: { flexDirection: "row", justifyContent: "space-between" } },
          el(
            View,
            null,
            el(Text, { style: styles.h1 }, "Atelier Pelissier"),
            el(Text, { style: styles.muted }, "Estimate / Soumission")
          ),
          el(
            View,
            null,
            el(Text, { style: { textAlign: "right" } }, today),
            project.jobNumber ? el(Text, { style: { textAlign: "right" } }, `#${project.jobNumber}`) : null,
            project.targetDate
              ? el(
                  Text,
                  { style: { textAlign: "right", color: "#6b7280" } },
                  `Livraison: ${new Date(project.targetDate).toLocaleDateString("fr-CA")}`
                )
              : null
          )
        ),

        clientName
          ? el(
              View,
              { style: { marginTop: 16, padding: 10, borderWidth: 1, borderColor: "#e5e7eb" } },
              el(Text, { style: { fontSize: 10, color: "#9ca3af" } }, "Client"),
              el(Text, { style: { fontSize: 12, fontWeight: 700 } }, clientName),
              project.clientEmail ? el(Text, { style: styles.muted }, project.clientEmail) : null,
              project.clientPhone ? el(Text, { style: styles.muted }, project.clientPhone) : null,
              project.clientPhone2 ? el(Text, { style: styles.muted }, project.clientPhone2) : null,
              project.clientAddress ? el(Text, { style: styles.muted }, project.clientAddress) : null
            )
          : null,

        el(
          View,
          { style: { marginTop: 16 } },
          el(Text, { style: { fontSize: 10, color: "#9ca3af" } }, "Projet"),
          el(Text, { style: { fontSize: 14, fontWeight: 700 } }, project.name),
          project.types ? el(Text, { style: styles.muted }, project.types) : null
        ),

        estimateLines.length > 0
          ? el(
              View,
              { style: styles.table },
              el(Text, { style: styles.h2 }, "Détails"),
              ...estimateLines.map((l, idx) =>
                el(
                  View,
                  { key: String(idx), style: styles.line },
                  el(Text, null, l.category.replace(/_/g, " ")),
                  el(Text, null, formatCurrency(l.amount))
                )
              )
            )
          : el(
              View,
              { style: { marginTop: 18 } },
              el(Text, { style: styles.muted }, "No estimate lines yet — configure the builders to generate a precise quote.")
            ),

        el(
          View,
          { style: { marginTop: 16, borderTopWidth: 1, borderTopColor: "#e5e7eb", paddingTop: 10 } },
          ...(estimateLines.length > 0
            ? [
                el(
                  View,
                  { key: "subtotal", style: styles.row },
                  el(Text, { style: styles.muted }, "Sous-total"),
                  el(Text, { style: styles.muted }, formatCurrency(subtotal))
                ),
                el(
                  View,
                  { key: "markup", style: styles.row },
                  el(Text, { style: styles.muted }, `Majoration (${markup}×)`),
                  el(Text, { style: styles.muted }, formatCurrency(afterMarkup))
                ),
                taxRate > 0
                  ? el(
                      View,
                      { key: "tax", style: styles.row },
                      el(Text, { style: styles.muted }, `Taxes (${(taxRate * 100).toFixed(3)}%)`),
                      el(Text, { style: styles.muted }, formatCurrency(tax))
                    )
                  : null,
              ].filter(Boolean)
            : []),
          el(
            View,
            { style: { ...styles.row, marginTop: 8 } },
            el(Text, { style: { fontSize: 13, fontWeight: 700 } }, "Total"),
            el(Text, { style: { fontSize: 13, fontWeight: 700 } }, formatCurrency(total))
          )
        ),

        project.stage === "quote"
          ? el(
              View,
              { style: { marginTop: 18 } },
              el(
                Text,
                { style: { fontSize: 10, color: "#6b7280" } },
                "Note: Some determining factors may still be revised by the salesperson before invoicing (TBD)."
              )
            )
          : null
      )
    )
  );

  return new NextResponse(pdf as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=\"${filename}\"`,
      "Cache-Control": "no-store",
    },
  });
});


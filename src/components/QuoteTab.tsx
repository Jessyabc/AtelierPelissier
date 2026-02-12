"use client";

import { formatCurrency } from "@/lib/format";

type Project = {
  name: string;
  types: string;
  isDraft: boolean;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientAddress: string | null;
  projectSettings: { markup: number; taxEnabled: boolean; taxRate: number } | null;
  costLines: Array<{ kind: string; category: string; amount: number }>;
};

function formatTypes(typesStr: string): string {
  return typesStr
    .split(",")
    .map((t) => t.trim().replace("_", " "))
    .filter(Boolean)
    .join(", ");
}

export function QuoteTab({ project }: { project: Project }) {
  const estimateLines = project.costLines.filter((l) => l.kind === "estimate");
  const subtotal = estimateLines.reduce((s, l) => s + l.amount, 0);
  const settings = project.projectSettings;
  const markup = settings?.markup ?? 2.5;
  const afterMarkup = subtotal * markup;
  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0.14975) : 0;
  const tax = afterMarkup * taxRate;
  const total = afterMarkup + tax;

  const clientName = [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ").trim() || "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h3 className="text-lg font-semibold text-gray-900">Quote / Estimate</h3>
        <button
          type="button"
          onClick={() => window.print()}
          className="neo-btn-primary px-4 py-2 text-sm font-medium print:hidden"
        >
          Print quote
        </button>
      </div>

      <div id="quote-print" className="neo-card p-6 print:border-0 print:shadow-none print:bg-white">
        <div className="mb-6 border-b border-gray-200 pb-4">
          <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
          <p className="text-sm text-gray-600">{formatTypes(project.types)}</p>
        </div>

        <div className="mb-6 grid gap-2 text-sm">
          <p><span className="font-medium text-gray-700">Client:</span> {clientName}</p>
          {project.clientEmail && <p><span className="font-medium text-gray-700">Email:</span> {project.clientEmail}</p>}
          {project.clientPhone && <p><span className="font-medium text-gray-700">Phone:</span> {project.clientPhone}</p>}
          {project.clientAddress && (
            <p><span className="font-medium text-gray-700">Address:</span> {project.clientAddress}</p>
          )}
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="py-2 font-medium text-gray-700">Category</th>
              <th className="py-2 text-right font-medium text-gray-700">Amount</th>
            </tr>
          </thead>
          <tbody>
            {estimateLines.map((l, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="py-2 text-gray-900">{l.category.replace(/_/g, " ")}</td>
                <td className="py-2 text-right text-gray-900">{formatCurrency(l.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Subtotal</span>
            <span>{formatCurrency(subtotal)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Markup ({markup}×)</span>
            <span>{formatCurrency(afterMarkup)}</span>
          </div>
          {taxRate > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-600">Tax ({(taxRate * 100).toFixed(2)}%)</span>
              <span>{formatCurrency(tax)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-200 pt-2 text-base font-semibold">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        <p className="mt-6 text-xs text-gray-500 print:mt-8">
          Atelier Pelissier · Estimate · {new Date().toLocaleDateString("en-CA")}
        </p>
      </div>
    </div>
  );
}

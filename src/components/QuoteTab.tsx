"use client";

import { formatCurrency } from "@/lib/format";

type Project = {
  name: string;
  types: string;
  isDraft: boolean;
  jobNumber?: string | null;
  targetDate?: string | null;
  clientFirstName: string | null;
  clientLastName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  clientPhone2?: string | null;
  clientAddress: string | null;
  sellingPrice?: number | null;
  projectSettings: { markup: number; taxEnabled: boolean; taxRate: number } | null;
  costLines: Array<{ kind: string; category: string; amount: number }>;
};

function formatTypes(typesStr: string): string {
  return typesStr
    .split(",")
    .map((t) => t.trim().replace(/_/g, " "))
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(", ");
}

function printQuote() {
  document.body.classList.add("printing-quote");
  window.print();
  setTimeout(() => document.body.classList.remove("printing-quote"), 500);
}

export function QuoteTab({ project, companyName }: { project: Project; companyName?: string }) {
  const estimateLines = project.costLines.filter((l) => l.kind === "estimate");
  const subtotal = estimateLines.reduce((s, l) => s + l.amount, 0);
  const settings = project.projectSettings;
  const markup = settings?.markup ?? 2.5;
  const afterMarkup = subtotal * markup;
  const taxRate = settings?.taxEnabled ? (settings?.taxRate ?? 0.14975) : 0;
  const tax = afterMarkup * taxRate;
  const computedTotal = afterMarkup + tax;
  const total = project.sellingPrice ?? computedTotal;
  const usingSellingPrice = !!project.sellingPrice;

  const clientName = [project.clientFirstName, project.clientLastName].filter(Boolean).join(" ").trim() || null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Quote / Estimate</h3>
          <p className="text-sm text-gray-500 mt-0.5">This is what the client sees when printed.</p>
        </div>
        <button
          type="button"
          onClick={printQuote}
          className="neo-btn-primary px-4 py-2 text-sm font-medium"
        >
          Print quote
        </button>
      </div>

      <div id="quote-print" className="neo-card p-8 max-w-2xl print:border-0 print:shadow-none print:bg-white print:max-w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{companyName ?? "Atelier Pelissier"}</h1>
            <p className="text-sm text-gray-500 mt-1">Estimate / Soumission</p>
          </div>
          <div className="text-right text-sm text-gray-600">
            <p>{new Date().toLocaleDateString("fr-CA")}</p>
            {project.jobNumber && <p className="font-medium text-gray-900 mt-1">#{project.jobNumber}</p>}
            {project.targetDate && (
              <p className="mt-1 text-gray-500">
                Livraison: {new Date(project.targetDate).toLocaleDateString("fr-CA")}
              </p>
            )}
          </div>
        </div>

        {/* Client block */}
        {clientName && (
          <div className="mb-8 rounded-lg bg-gray-50 px-5 py-4 print:bg-white print:border print:border-gray-200">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Client</p>
            <p className="font-semibold text-gray-900">{clientName}</p>
            {project.clientEmail && <p className="text-sm text-gray-600 mt-0.5">{project.clientEmail}</p>}
            {project.clientPhone && <p className="text-sm text-gray-600">{project.clientPhone}</p>}
            {project.clientPhone2 && <p className="text-sm text-gray-600">{project.clientPhone2}</p>}
            {project.clientAddress && <p className="text-sm text-gray-600 mt-1">{project.clientAddress}</p>}
          </div>
        )}

        {/* Project description */}
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Projet</p>
          <p className="font-semibold text-gray-900 text-lg">{project.name}</p>
          {project.types && <p className="text-sm text-gray-600 mt-0.5">{formatTypes(project.types)}</p>}
        </div>

        {/* Cost lines */}
        {estimateLines.length > 0 && !usingSellingPrice && (
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="border-b-2 border-gray-200 text-left">
                <th className="pb-2 font-semibold text-gray-700">Description</th>
                <th className="pb-2 text-right font-semibold text-gray-700">Montant</th>
              </tr>
            </thead>
            <tbody>
              {estimateLines.map((l, i) => (
                <tr key={i} className="border-b border-gray-100">
                  <td className="py-2.5 text-gray-800">{l.category.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</td>
                  <td className="py-2.5 text-right text-gray-800">{formatCurrency(l.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Totals */}
        <div className="border-t-2 border-gray-200 pt-4 space-y-1.5 text-sm">
          {!usingSellingPrice && estimateLines.length > 0 && (
            <>
              <div className="flex justify-between text-gray-600">
                <span>Sous-total</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>Majoration ({markup}×)</span>
                <span>{formatCurrency(afterMarkup)}</span>
              </div>
            </>
          )}
          {taxRate > 0 && (
            <div className="flex justify-between text-gray-600">
              <span>Taxes ({(taxRate * 100).toFixed(3)}%)</span>
              <span>{formatCurrency(usingSellingPrice ? total * taxRate / (1 + taxRate) : tax)}</span>
            </div>
          )}
          <div className="flex justify-between pt-2 text-base font-bold text-gray-900 border-t border-gray-200">
            <span>Total</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-6 border-t border-gray-100 text-xs text-gray-400 flex justify-between">
          <span>{companyName ?? "Atelier Pelissier"} · Soumission</span>
          <span>Valide 30 jours · {new Date().toLocaleDateString("fr-CA")}</span>
        </div>
      </div>
    </div>
  );
}

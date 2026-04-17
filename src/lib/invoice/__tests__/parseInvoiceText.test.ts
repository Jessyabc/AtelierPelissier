import { parseInvoiceText } from "../parseInvoiceText";

describe("parseInvoiceText", () => {
  it("returns empty for empty input", () => {
    const r = parseInvoiceText("");
    expect(r).toEqual({ client: {} });
  });

  it("extracts invoice number with dash prefix", () => {
    const r = parseInvoiceText("Invoice #MC-6199\nSome details");
    expect(r.invoiceNumber).toBe("MC-6199");
  });

  it("extracts invoice number from 'Number: MC-6629' format (MoncCost invoices)", () => {
    const r = parseInvoiceText("Number: MC-6629\nReference: LCH | JAB | LCH");
    expect(r.invoiceNumber).toBe("MC-6629");
  });

  it("extracts email", () => {
    const r = parseInvoiceText("Contact: john@example.com\nPhone");
    expect(r.client?.email).toBe("john@example.com");
  });

  it("extracts phone in parentheses format", () => {
    const r = parseInvoiceText("Phone: (514) 555-1234");
    expect(r.client?.phone).toMatch(/514.*555.*1234/);
  });

  it("extracts phone in dash-inside-parens format (514-642-1998)", () => {
    const r = parseInvoiceText("Some Client\n(514-642-1998)\n1551 31e avenue");
    expect(r.client?.phone).toMatch(/514.*642.*1998/);
  });

  it("extracts client name from 'Bill To' label", () => {
    const text = [
      "Invoice #AB-1234",
      "Bill To:",
      "Jane Smith",
      "123 Main St",
    ].join("\n");
    const r = parseInvoiceText(text);
    expect(r.client?.firstName).toBe("Jane");
    expect(r.client?.lastName).toBe("Smith");
    expect(r.client?.address).toBe("123 Main St");
  });

  it("handles inline 'Client: Name' format", () => {
    const r = parseInvoiceText("Client: John Doe\n123 Main St");
    expect(r.client?.firstName).toBe("John");
    expect(r.client?.lastName).toBe("Doe");
  });

  it("extracts unlabeled client name from the line immediately before a phone number", () => {
    // MoncCost/EvosBoutiques invoice format: client name is in a box without a label,
    // phone appears on the very next line.
    const text = [
      "Number: MC-6629",
      "Jacques Chouinard & Noella Tardif",
      "(514-642-1998)",
      "1551 31e avenue",
      "Pointe-Aux-Trembles QC H1A 3M9",
    ].join("\n");
    const r = parseInvoiceText(text);
    expect(r.client?.firstName).toBe("Jacques");
    expect(r.client?.lastName).toContain("Chouinard");
    expect(r.client?.phone).toMatch(/514.*642.*1998/);
    expect(r.client?.address).toBe("1551 31e avenue");
  });

  it("does not confuse a company address line (starting with digits) with a client name", () => {
    // "516 Montée des Pionniers…" starts with a digit → should not be picked up as client
    const text = [
      "516 Montée des Pionniers, Terrebonne, QC J6V 1N9",
      "(514) 645-5959",
      "Jacques Client",
      "(514) 111-2222",
      "100 Rue Principale",
    ].join("\n");
    const r = parseInvoiceText(text);
    expect(r.client?.firstName).toBe("Jacques");
    expect(r.client?.lastName).toBe("Client");
    expect(r.client?.phone).toMatch(/514.*111.*2222/);
  });

  it("uses the client-specific phone, not the first phone in the document", () => {
    // Company phone appears before the client block
    const text = [
      "EvosBoutiques",
      "www.evosboutiques.ca",
      "514-645-5959",
      "Jacques Chouinard",
      "(514-642-1998)",
      "1551 31e avenue",
    ].join("\n");
    const r = parseInvoiceText(text);
    expect(r.client?.phone).toMatch(/514.*642.*1998/);
  });

  it("does not return a client object if nothing was found", () => {
    const r = parseInvoiceText("Totally unrelated text with no fields");
    expect(r.client).toBeUndefined();
  });

  it("falls back to a plausible description line when no item table header is present", () => {
    const text = "Kitchen renovation project\nInvoice #XY-9999\nTotal: 5000";
    const r = parseInvoiceText(text);
    expect(r.description).toContain("Kitchen");
  });

  it("extracts item names from invoice table as description (MoncCost format)", () => {
    const text = [
      "Number: MC-6629",
      "Item Qty/Hrs Price/Rate Discount Sales Tax Net",
      "Vanité produite Sur Mesure",
      "Dimensions hors tout: 59\"1/2 (L) - 34\" (H) - 21\"1/2 (P)",
      "Nombre de tiroirs: 6",
      "Style de porte: Slab/Flat",
      "1.00 2,750.00 GST 5.00% 2,750.00",
      "Comptoir produit sur mesure",
      "1.00 851.67 GST 5.00% 851.67",
      "Maquilleuse produite Sur Mesure (partie du bas)",
    ].join("\n");
    const r = parseInvoiceText(text);
    expect(r.description).toContain("Vanité produite Sur Mesure");
    expect(r.description).toContain("Comptoir produit sur mesure");
    expect(r.description).toContain("Maquilleuse produite Sur Mesure");
  });

  it("deduplicates repeated item names in description", () => {
    const text = [
      "Item Qty/Hrs Price/Rate",
      "Comptoir produit sur mesure",
      "1.00 851.67",
      "Item Qty/Hrs Price/Rate",
      "Comptoir produit sur mesure",
      "1.00 648.87",
    ].join("\n");
    const r = parseInvoiceText(text);
    // Should appear only once
    expect(r.description?.split("Comptoir produit sur mesure").length).toBe(2);
  });
});

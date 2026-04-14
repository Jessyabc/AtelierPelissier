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

  it("extracts email", () => {
    const r = parseInvoiceText("Contact: john@example.com\nPhone");
    expect(r.client?.email).toBe("john@example.com");
  });

  it("extracts phone in parentheses format", () => {
    const r = parseInvoiceText("Phone: (514) 555-1234");
    expect(r.client?.phone).toMatch(/514.*555.*1234/);
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

  it("does not return a client object if nothing was found", () => {
    const r = parseInvoiceText("Totally unrelated text with no fields");
    expect(r.client).toBeUndefined();
  });

  it("falls back to a plausible description line", () => {
    const text = "Kitchen renovation project\nInvoice #XY-9999\nTotal: 5000";
    const r = parseInvoiceText(text);
    expect(r.description).toContain("Kitchen");
  });
});

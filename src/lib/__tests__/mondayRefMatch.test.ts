import { scoreMondayRefMatch, parseMondayItemName, guessRoomType } from "@/lib/monday";

describe("scoreMondayRefMatch", () => {
  it("matches job column exactly", () => {
    expect(scoreMondayRefMatch("x", "MC-6372", "MC-6372")).toBe(100);
  });

  it("matches name prefix with MC job label", () => {
    expect(
      scoreMondayRefMatch("MC-6372 (Judith Bélanger Richer)", null, "MC-6372")
    ).toBe(86);
  });

  it("matches name prefix when ref is full start", () => {
    expect(scoreMondayRefMatch("MC-6513 Alexis Martin", null, "MC-6513")).toBe(86);
  });

  it("returns 0 for unrelated strings", () => {
    expect(scoreMondayRefMatch("Other job", null, "MC-9999")).toBe(0);
  });
});

describe("parseMondayItemName", () => {
  it("parses MC-xxxx (Client Name)", () => {
    const r = parseMondayItemName("MC-6372 (Judith Bélanger Richer)");
    expect(r.jobNumber).toBe("MC-6372");
    expect(r.clientName).toBe("Judith Bélanger Richer");
    expect(r.clientPhone).toBeNull();
  });

  it("parses MC-xxxx Client Name (phone)", () => {
    const r = parseMondayItemName("MC-6513 Alexis Martin (514-808-2362)");
    expect(r.jobNumber).toBe("MC-6513");
    expect(r.clientName).toBe("Alexis Martin");
    expect(r.clientPhone).toBe("514-808-2362");
  });

  it("parses MC-xxxx (Client Name phone)", () => {
    const r = parseMondayItemName("MC-6776 (Stéphane Caron 514-829-8935)");
    expect(r.jobNumber).toBe("MC-6776");
    expect(r.clientName).toBe("Stéphane Caron");
    expect(r.clientPhone).toBe("514-829-8935");
  });

  it("handles names without MC prefix", () => {
    const r = parseMondayItemName("AMH Construction (Projet Mercier)");
    expect(r.jobNumber).toBeNull();
    expect(r.clientName).toBe("AMH Construction Projet Mercier");
    expect(r.clientPhone).toBeNull();
  });

  it("handles bare names", () => {
    const r = parseMondayItemName("Agregar tarea");
    expect(r.jobNumber).toBeNull();
    expect(r.clientName).toBe("Agregar tarea");
  });

  it("handles empty string", () => {
    const r = parseMondayItemName("");
    expect(r.jobNumber).toBeNull();
    expect(r.clientName).toBeNull();
  });

  it("normalizes MC without dash", () => {
    const r = parseMondayItemName("MC6399 (Carl Laroche)");
    expect(r.jobNumber).toBe("MC-6399");
    expect(r.clientName).toBe("Carl Laroche");
  });
});

describe("guessRoomType", () => {
  it("detects kitchen", () => {
    expect(guessRoomType("Cuisine")).toBe("kitchen");
    expect(guessRoomType("cuisine")).toBe("kitchen");
    expect(guessRoomType("Kitchen")).toBe("kitchen");
    expect(guessRoomType("Îlot central")).toBe("kitchen");
  });

  it("detects vanity", () => {
    expect(guessRoomType("Vanité")).toBe("vanity");
    expect(guessRoomType("vanité produite sur mesure")).toBe("vanity");
    expect(guessRoomType("Vanite sur mesure")).toBe("vanity");
    expect(guessRoomType("Salle de bain - meuble lavabo")).toBe("vanity");
    expect(guessRoomType("Bathroom vanity")).toBe("vanity");
  });

  it("detects side unit", () => {
    expect(guessRoomType("Unité de rangement sur vanité GAUCHE")).toBe("side_unit");
    expect(guessRoomType("Unite de rangement sur vanite DROITE")).toBe("side_unit");
    expect(guessRoomType("Unité au dessus de la laveuse sécheuse")).toBe("side_unit");
    expect(guessRoomType("Storage unit")).toBe("side_unit");
  });

  it("detects closet", () => {
    expect(guessRoomType("Garde-robe")).toBe("closet");
    expect(guessRoomType("Walk-in master")).toBe("closet");
    expect(guessRoomType("Closet organizers")).toBe("closet");
  });

  it("defaults to custom", () => {
    expect(guessRoomType("Retombée plafond")).toBe("custom");
    expect(guessRoomType("Pharmacie de 34,5 pouces")).toBe("custom");
    expect(guessRoomType("Comptoir Dekton (Shawn)")).toBe("custom");
  });
});

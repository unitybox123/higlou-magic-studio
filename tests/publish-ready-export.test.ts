import { describe, expect, it } from "vitest";
import {
  generateEbayCsvFromTemplate,
  loadSeedTemplateRaw,
  parseEbayTemplate,
  splitCsvLine,
} from "@/lib/csv/ebay-template";

describe("official Create Drafts export identity", () => {
  it("keeps exact draft INFO so Seller Hub can identify the template", () => {
    const raw = loadSeedTemplateRaw();
    const parsed = parseEbayTemplate(raw);
    expect(parsed.meta.templateType).toBe("draft_listing");
    expect(parsed.meta.rawInfoLine).toBe(
      "#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,",
    );
  });

  it("does not append shipping columns on official Create Drafts export", () => {
    const raw = loadSeedTemplateRaw();
    const parsed = parseEbayTemplate(raw);
    const csv = generateEbayCsvFromTemplate({
      templateRaw: raw,
      valuesByHeader: {
        [parsed.meta.actionHeader]: "Draft",
        "Category ID": "177019",
        Title: "Plaid Comforter Set",
        Price: "45",
        Quantity: "1",
        Format: "FixedPrice",
        PostalCode: "46947",
        Country: "US",
        WeightMajor: "6",
        WeightMinor: "0",
        "Shipping service 1 option": "USPSGroundAdvantage",
        "Shipping service 1 cost": "0.00",
      },
      appendPublishReadyColumns: false,
    });
    const lines = csv.slice(1).trimEnd().split(/\r?\n/);
    expect(lines[0]).toBe(
      "#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,",
    );
    const headers = splitCsvLine(lines[4]);
    const row = splitCsvLine(lines[5]);
    expect(row[headers.indexOf(parsed.meta.actionHeader)]).toBe("Draft");
    expect(headers).not.toContain("PostalCode");
    expect(headers).not.toContain("Shipping service 1 option");
  });

  it("can append shipping columns for Create/Schedule templates", () => {
    const raw = loadSeedTemplateRaw();
    const parsed = parseEbayTemplate(raw);
    const csv = generateEbayCsvFromTemplate({
      templateRaw: raw,
      valuesByHeader: {
        [parsed.meta.actionHeader]: "Draft",
        "Category ID": "177019",
        Title: "Plaid Comforter Set",
        Price: "45",
        Quantity: "1",
        Format: "FixedPrice",
        PostalCode: "46947",
        Country: "US",
        WeightMajor: "6",
        WeightMinor: "0",
        "Shipping service 1 option": "USPSGroundAdvantage",
        "Shipping service 1 cost": "0.00",
      },
      appendPublishReadyColumns: true,
    });
    const lines = csv.slice(1).trimEnd().split(/\r?\n/);
    expect(lines[0]).toBe(
      "#INFO,Version=0.0.2,Template= eBay-draft-listings-template_US,,,,,,,,",
    );
    const headers = splitCsvLine(lines[4]);
    const row = splitCsvLine(lines[5]);
    expect(row[headers.indexOf(parsed.meta.actionHeader)]).toBe("Draft");
    expect(headers).toContain("PostalCode");
    expect(headers).toContain("Shipping service 1 option");
    expect(row[headers.indexOf("PostalCode")]).toBe("46947");
    expect(row[headers.indexOf("Shipping service 1 option")]).toBe(
      "USPSGroundAdvantage",
    );
  });
});

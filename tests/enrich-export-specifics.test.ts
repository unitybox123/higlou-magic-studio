import { describe, expect, it } from "vitest";
import { enrichItemSpecificsForExport } from "@/lib/ebay/enrich-export-specifics";

describe("enrichItemSpecificsForExport", () => {
  it("adds required Brand from listing when missing in itemSpecifics", () => {
    const columns = enrichItemSpecificsForExport({
      categoryId: "177019",
      itemSpecifics: [
        { key: "C:Type", value: "Comforter Set" },
        { key: "C:Color", value: "Blue" },
      ],
      brand: "Higlou",
      size: "Queen",
    });

    expect(columns["C:Brand"]).toBe("Higlou");
    expect(columns["C:Size"]).toBe("Queen");
    expect(columns["C:Type"]).toBe("Comforter Set");
  });

  it("uses Unbranded when brand is required but unknown", () => {
    const columns = enrichItemSpecificsForExport({
      categoryId: "177019",
      itemSpecifics: [{ key: "C:Type", value: "Comforter Set" }],
    });

    expect(columns["C:Brand"]).toBe("Unbranded");
  });
});

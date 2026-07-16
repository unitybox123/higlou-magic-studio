import { describe, expect, it } from "vitest";
import { analysisResultSchema } from "@/types/analysis";

describe("analysisResultSchema soft coercion", () => {
  it("accepts null conditionId and fills NEW from condition", () => {
    const parsed = analysisResultSchema.parse({
      title: "Mainstays Queen Set",
      brand: "Mainstays",
      collection: null,
      model: null,
      mpn: null,
      upc: null,
      categoryId: null,
      categoryName: "Comforter Sets",
      condition: "New",
      conditionId: null,
      price: 49.99,
      quantity: 1,
      size: "Queen",
      type: "Comforter Set",
      colors: ["Yellow", null, "Gray"],
      materials: null,
      pattern: null,
      style: null,
      department: null,
      room: null,
      features: ["Soft"],
      setIncludes: null,
      numberOfItems: 10,
      careInstructions: null,
      countryOfManufacture: null,
      descriptionSummary: "A queen comforter set",
      detectedText: null,
      warnings: null,
      confidence: {
        brand: 0.9,
        model: 0.2,
        upc: null,
        category: 0.8,
        size: 0.9,
        condition: 0.85,
      },
    });

    expect(parsed.conditionId).toBe("NEW");
    expect(parsed.collection).toBe("");
    expect(parsed.colors).toEqual(["Yellow", "Gray"]);
    expect(parsed.confidence.upc).toBe(0);
  });
});

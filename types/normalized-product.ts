import type { ConfidentField } from "@/lib/ai/confidence-engine";

export type NormalizedProduct = {
  identity: {
    productType: ConfidentField<string>;
    brand: ConfidentField<string>;
    model: ConfidentField<string>;
    mpn: ConfidentField<string>;
    upc: ConfidentField<string>;
  };
  attributes: Record<string, ConfidentField<string | number | boolean>>;
  condition: {
    type: ConfidentField<
      "new" | "open_box" | "used" | "for_parts" | "unknown"
    >;
    notes: ConfidentField<string>;
    defects: Array<ConfidentField<string>>;
  };
  includedItems: Array<ConfidentField<string>>;
  missingItems: Array<ConfidentField<string>>;
  media: {
    imageUrls: string[];
    imageHashes: string[];
  };
  commerce: {
    title: ConfidentField<string>;
    description: ConfidentField<string>;
    price: ConfidentField<number>;
    quantity: number;
  };
  marketplace: {
    ebay?: {
      categoryId: ConfidentField<string>;
      itemSpecifics: Record<string, ConfidentField<string>>;
      conditionId: ConfidentField<string>;
    };
  };
  analysis: {
    productFingerprint: string;
    pipelineVersion: string;
    promptVersion: string;
    overallConfidence: number;
    requiresReview: boolean;
    warnings: string[];
    cacheHit?: boolean;
    planReasons?: string[];
    savingsNote?: string;
  };
};

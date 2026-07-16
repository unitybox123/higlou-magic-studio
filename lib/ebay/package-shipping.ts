/**
 * Estimate package weight / dimensions and pick a sensible domestic shipping service
 * so Seller Hub Create/Schedule uploads are publish-ready.
 */

export type PackageEstimate = {
  weightLbs: number;
  weightOz: number;
  /** Total ounces for bands. */
  totalOz: number;
  packageType: string;
  lengthIn: number;
  widthIn: number;
  depthIn: number;
  measurementSystem: "ENGLISH";
  shippingType: "Flat";
  shippingService: string;
  shippingCost: number;
  shippingPriority: number;
  weightUnit: "lbs";
  reason: string;
};

function parseFluidOz(text: string): number | null {
  const fl = text.match(
    /(\d+(?:\.\d+)?)\s*(?:fl\.?\s*oz|fluid\s*ounces?)\b/i,
  );
  if (fl) return Number(fl[1]);
  const ml = text.match(/(\d+(?:\.\d+)?)\s*ml\b/i);
  if (ml) return Number(ml[1]) / 29.5735;
  const liter = text.match(/(\d+(?:\.\d+)?)\s*l(?:iter)?s?\b/i);
  if (liter && Number(liter[1]) < 10) return Number(liter[1]) * 33.814;
  return null;
}

function toLbsOz(totalOz: number): { lbs: number; oz: number } {
  const clamped = Math.max(1, Math.round(totalOz));
  const lbs = Math.floor(clamped / 16);
  const oz = clamped % 16;
  return { lbs, oz: oz === 0 && lbs > 0 ? 0 : oz || (lbs === 0 ? 1 : 0) };
}

function pickService(totalOz: number): {
  shippingService: string;
  shippingCost: number;
  reason: string;
} {
  if (totalOz <= 16) {
    return {
      shippingService: "USPSGroundAdvantage",
      shippingCost: 0,
      reason: "Light parcel ≤1 lb → USPS Ground Advantage (flat $0)",
    };
  }
  if (totalOz <= 192) {
    return {
      shippingService: "USPSGroundAdvantage",
      shippingCost: 0,
      reason: "Small/medium parcel → USPS Ground Advantage (flat $0)",
    };
  }
  if (totalOz <= 320) {
    return {
      shippingService: "USPSPriority",
      shippingCost: 0,
      reason: "Heavier parcel → USPS Priority Mail (flat $0)",
    };
  }
  return {
    shippingService: "UPSGround",
    shippingCost: 0,
    reason: "Bulky/heavy parcel → UPS Ground (flat $0)",
  };
}

export function estimatePackageAndShipping(input: {
  title?: string | null;
  productType?: string | null;
  size?: string | null;
  categoryName?: string | null;
  brand?: string | null;
  quantity?: number | null;
}): PackageEstimate {
  const haystack = [
    input.title,
    input.productType,
    input.size,
    input.categoryName,
    input.brand,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const qty = Math.max(1, Number(input.quantity) || 1);
  let unitOz = 12;
  let lengthIn = 10;
  let widthIn = 8;
  let depthIn = 4;
  let packageType = "PackageThickEnvelope";

  const fluidOz = parseFluidOz(
    [input.size, input.title, input.productType].filter(Boolean).join(" "),
  );

  if (fluidOz != null) {
    unitOz = Math.ceil(fluidOz + 3);
    lengthIn = 10;
    widthIn = 5;
    depthIn = 5;
  } else if (
    /\b(vacuum|robot\s*vacuum|roomba|dyson|shark)\b/.test(haystack) ||
    /\bvacuum cleaners?\b/.test(haystack)
  ) {
    // Matches typical Seller Hub estimate for boxed robot vacuums.
    unitOz = 192; // 12 lb
    lengthIn = 21;
    widthIn = 16;
    depthIn = 5;
  } else if (/\b(comforter|duvet|bedding|blanket|quilt)\b/.test(haystack)) {
    unitOz = 96;
    lengthIn = 20;
    widthIn = 16;
    depthIn = 10;
  } else if (/\b(sneaker|shoe|boot)\b/.test(haystack)) {
    unitOz = 40;
    lengthIn = 14;
    widthIn = 10;
    depthIn = 6;
  } else if (
    /\b(phone|case|cable|charger|earbuds|small\s*electronics)\b/.test(haystack)
  ) {
    unitOz = 8;
    lengthIn = 9;
    widthIn = 6;
    depthIn = 2;
  } else if (/\b(laptop|monitor|tv)\b/.test(haystack)) {
    unitOz = 128;
    lengthIn = 22;
    widthIn = 16;
    depthIn = 6;
  } else if (/\b(atv|generator|appliance)\b/.test(haystack)) {
    unitOz = 480;
    lengthIn = 36;
    widthIn = 24;
    depthIn = 24;
    packageType = "USPSLargePack";
  }

  const totalOz = Math.max(1, Math.round(unitOz * qty));
  const { lbs, oz } = toLbsOz(totalOz);
  const service = pickService(totalOz);

  return {
    weightLbs: lbs,
    weightOz: oz === 0 && lbs === 0 ? 1 : oz,
    totalOz,
    packageType,
    lengthIn,
    widthIn,
    depthIn,
    measurementSystem: "ENGLISH",
    shippingType: "Flat",
    shippingService: service.shippingService,
    shippingCost: service.shippingCost,
    shippingPriority: 1,
    weightUnit: "lbs",
    reason: service.reason,
  };
}

/**
 * Map estimate onto File Exchange / Seller Hub Create-or-Schedule headers.
 * Prefer PostalCode over Location (official: use one, not both).
 */
export function packageEstimateToCsvValues(
  estimate: PackageEstimate,
  options?: { includeInlineShippingService?: boolean },
): Record<string, string> {
  const cost = estimate.shippingCost.toFixed(2);
  const includeService = options?.includeInlineShippingService !== false;

  const values: Record<string, string> = {
    WeightMajor: String(estimate.weightLbs),
    WeightMinor: String(estimate.weightOz),
    WeightUnit: estimate.weightUnit,
    "Package weight (lbs)": String(estimate.weightLbs),
    "Package weight (oz)": String(estimate.weightOz),
    PackageType: estimate.packageType,
    MeasurementSystem: estimate.measurementSystem,
    PackageLength: String(estimate.lengthIn),
    PackageWidth: String(estimate.widthIn),
    PackageDepth: String(estimate.depthIn),
    "Package length": String(estimate.lengthIn),
    "Package width": String(estimate.widthIn),
    "Package depth": String(estimate.depthIn),
    ShippingType: estimate.shippingType,
    "Shipping type": estimate.shippingType,
    Duration: "GTC",
  };

  if (includeService) {
    values["Shipping service 1 option"] = estimate.shippingService;
    values["ShippingService-1:Option"] = estimate.shippingService;
    values["Shipping service 1 cost"] = cost;
    values["ShippingService-1:Cost"] = cost;
    values["Shipping service 1 priority"] = String(estimate.shippingPriority);
    values["ShippingService-1:Priority"] = String(estimate.shippingPriority);
  }

  return values;
}

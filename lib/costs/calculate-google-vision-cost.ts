export type GoogleVisionPricing = {
  freeUnitsMonthly: number;
  pricePer1000Units: number;
};

/**
 * Estimated Google Vision cost for OCR units this month.
 * Free tier is applied to monthly cumulative units first.
 * Partial blocks are prorated (units/1000 * price).
 */
export function calculateGoogleVisionCost(options: {
  /** Units already used this month before this operation */
  unitsUsedThisMonthBefore?: number;
  /** Units consumed by this operation (or the window being priced) */
  units: number;
  pricing: GoogleVisionPricing;
  /** When true, treat `units` as month-to-date total (not incremental) */
  unitsAreMonthToDate?: boolean;
}): {
  billableUnits: number;
  freeUnitsApplied: number;
  estimatedCost: number;
} {
  const before = Math.max(0, options.unitsUsedThisMonthBefore ?? 0);
  const free = Math.max(0, options.pricing.freeUnitsMonthly);
  const price = options.pricing.pricePer1000Units;

  if (Number.isNaN(price) || options.units <= 0) {
    return { billableUnits: 0, freeUnitsApplied: 0, estimatedCost: 0 };
  }

  let billableUnits = 0;
  let freeUnitsApplied = 0;

  if (options.unitsAreMonthToDate) {
    const total = options.units;
    freeUnitsApplied = Math.min(total, free);
    billableUnits = Math.max(0, total - free);
  } else {
    const remainingFree = Math.max(0, free - before);
    freeUnitsApplied = Math.min(options.units, remainingFree);
    billableUnits = Math.max(0, options.units - freeUnitsApplied);
  }

  const estimatedCost = (billableUnits / 1000) * price;

  return { billableUnits, freeUnitsApplied, estimatedCost };
}

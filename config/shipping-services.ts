export type ShippingServiceOption = {
  code: string;
  label: string;
  hint: string;
};

/** Domestic services commonly shown in Seller Hub "Add services". */
export const SHIPPING_SERVICE_OPTIONS: ShippingServiceOption[] = [
  {
    code: "USPSGroundAdvantage",
    label: "USPS Ground Advantage",
    hint: "2–5 days · best for most small/medium parcels",
  },
  {
    code: "USPSPriority",
    label: "USPS Priority Mail",
    hint: "1–3 days · heavier or time-sensitive",
  },
  {
    code: "UPSGround",
    label: "UPS Ground",
    hint: "1–5 days · bulky / heavier boxes",
  },
  {
    code: "UPSGroundSaver",
    label: "UPS Ground Saver",
    hint: "Economy · lighter wholesale boxes",
  },
  {
    code: "FedExGround",
    label: "FedEx Ground",
    hint: "1–5 days · medium/heavy parcels",
  },
  {
    code: "FedExHomeDelivery",
    label: "FedEx Home Delivery",
    hint: "Residential medium parcels",
  },
  {
    code: "EconomyShipping",
    label: "Economy Shipping",
    hint: "1–10 days · cheapest slow option",
  },
  {
    code: "StandardShipping",
    label: "Standard Shipping",
    hint: "Generic standard when category-limited",
  },
];

export function findShippingServiceOption(code: string | null | undefined) {
  const normalized = String(code || "").trim();
  return (
    SHIPPING_SERVICE_OPTIONS.find((o) => o.code === normalized) ?? null
  );
}

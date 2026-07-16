export interface ConditionOption {
  label: string;
  conditionId: string;
  categories?: string[];
}

/** Maps visible condition labels to values acceptable for Seller Hub templates. */
export const CONDITION_OPTIONS: ConditionOption[] = [
  { label: "New", conditionId: "NEW", categories: ["*"] },
  { label: "New with tags", conditionId: "1000" },
  { label: "New without tags", conditionId: "1500" },
  { label: "New other", conditionId: "1750" },
  { label: "Open box", conditionId: "1500" },
  { label: "Excellent refurbished", conditionId: "2000" },
  { label: "Very good refurbished", conditionId: "2010" },
  { label: "Good refurbished", conditionId: "2020" },
  { label: "Certified refurbished", conditionId: "2500" },
  { label: "Seller refurbished", conditionId: "2500" },
  { label: "Pre-owned", conditionId: "3000" },
  { label: "Used", conditionId: "3000" },
  { label: "For parts or not working", conditionId: "7000" },
];

export function resolveConditionId(
  label: string,
  categoryFamily?: string,
): string {
  const match = CONDITION_OPTIONS.find(
    (option) => option.label.toLowerCase() === label.toLowerCase(),
  );
  if (!match) return "";
  if (categoryFamily === "bedding" && match.label === "New") return "NEW";
  return match.conditionId;
}

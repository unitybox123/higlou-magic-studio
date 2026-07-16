export function confidenceBand(
  confidence: number,
): "high" | "medium" | "low" {
  if (confidence >= 0.85) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

export function shouldNeedsReview(confidence: number, empty: boolean) {
  return empty || confidence < 0.6;
}

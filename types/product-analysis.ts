export type EvidenceSource =
  | "openai_visual"
  | "google_vision_ocr"
  | "zxing_barcode"
  | "user_input"
  | "settings_default"
  | "derived";

export interface Evidence<T> {
  value: T | null;
  confidence: number;
  source: EvidenceSource;
  sourceImageIds: string[];
  rawText?: string;
  needsReview: boolean;
  reason?: string;
}

export interface FieldConflict {
  field: string;
  values: Array<{
    value: string;
    source: EvidenceSource;
    confidence: number;
  }>;
  chosen: string | null;
  reason: string;
}

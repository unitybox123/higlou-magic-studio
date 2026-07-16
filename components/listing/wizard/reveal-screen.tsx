"use client";

import { AnalysisComplete } from "@/components/listing/analysis-complete";
import type { AnalysisCostEstimate } from "@/components/listing/analysis-cost-panel";
import { WizardFrame } from "@/components/listing/wizard/wizard-frame";

export function RevealScreen({
  photoCount,
  hasBrand,
  hasCategory,
  hasHtml,
  imagesOrganized,
  confidence,
  costEstimate,
  attentionCount,
  productName,
  onReview,
}: {
  photoCount: number;
  hasBrand: boolean;
  hasCategory: boolean;
  hasHtml: boolean;
  imagesOrganized: boolean;
  confidence: number;
  costEstimate: AnalysisCostEstimate | null;
  attentionCount: number;
  productName?: string;
  onReview: () => void;
}) {
  return (
    <WizardFrame step="reveal">
      <AnalysisComplete
        photoCount={photoCount}
        hasBrand={hasBrand}
        hasCategory={hasCategory}
        hasHtml={hasHtml}
        imagesOrganized={imagesOrganized}
        confidence={confidence}
        costEstimate={costEstimate}
        attentionCount={attentionCount}
        productName={productName}
        onReview={onReview}
      />
    </WizardFrame>
  );
}

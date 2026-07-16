"use client";

import { Badge } from "@/components/ui/badge";

export type AnalysisCostEstimate = {
  openai?: number;
  googleVisionUnits?: number;
  model?: string;
  tier?: string;
  escalationReason?: string;
  disclaimer?: string;
  inputTokens?: number;
  outputTokens?: number;
  imageCount?: number;
  ocrImageCount?: number;
  barcodeCount?: number;
  retries?: number;
  cacheHit?: boolean;
  savingsNote?: string;
};

export function AnalysisCostPanel({
  estimate,
  open,
}: {
  estimate: AnalysisCostEstimate | null;
  open?: boolean;
}) {
  if (!estimate || open === false) return null;

  return (
    <details className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm">
      <summary className="cursor-pointer font-medium text-zinc-800">
        Analysis cost estimate
      </summary>
      <div className="mt-3 space-y-2 text-zinc-700">
        <p className="text-xs text-zinc-500">
          {estimate.disclaimer ||
            "Estimated platform operating cost only. Not an official invoice."}
        </p>
        <div className="flex flex-wrap gap-2">
          {estimate.tier ? (
            <Badge variant="secondary">Tier: {estimate.tier}</Badge>
          ) : null}
          {estimate.model ? (
            <Badge variant="secondary">{estimate.model}</Badge>
          ) : null}
          {estimate.cacheHit ? (
            <Badge className="bg-emerald-100 text-emerald-800">Cache hit · $0</Badge>
          ) : null}
        </div>
        <ul className="space-y-1">
          {typeof estimate.openai === "number" ? (
            <li>Estimated OpenAI: ${estimate.openai.toFixed(4)}</li>
          ) : null}
          {typeof estimate.googleVisionUnits === "number" ? (
            <li>Google Vision OCR units: {estimate.googleVisionUnits}</li>
          ) : null}
          {typeof estimate.imageCount === "number" ? (
            <li>Images sent to OpenAI: {estimate.imageCount}</li>
          ) : null}
          {typeof estimate.ocrImageCount === "number" ? (
            <li>Images sent to Vision: {estimate.ocrImageCount}</li>
          ) : null}
          {typeof estimate.barcodeCount === "number" ? (
            <li>Barcode scans: {estimate.barcodeCount}</li>
          ) : null}
          {estimate.savingsNote ? (
            <li>Optimizer: {estimate.savingsNote}</li>
          ) : null}
          {estimate.escalationReason ? (
            <li>Escalation: {estimate.escalationReason}</li>
          ) : null}
        </ul>
      </div>
    </details>
  );
}

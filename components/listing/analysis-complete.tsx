"use client";

import { Check, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisCostEstimate } from "@/components/listing/analysis-cost-panel";
import {
  estimateAnalysisMinutes,
  formatCostEstimate,
} from "@/components/listing/review-helpers";

export function AnalysisComplete({
  photoCount,
  hasBrand,
  hasCategory,
  hasHtml,
  imagesOrganized,
  confidence,
  costEstimate,
  onReview,
  attentionCount = 0,
  productName,
}: {
  photoCount: number;
  hasBrand: boolean;
  hasCategory: boolean;
  hasHtml: boolean;
  imagesOrganized: boolean;
  confidence: number;
  costEstimate: AnalysisCostEstimate | null;
  onReview: () => void;
  attentionCount?: number;
  productName?: string;
}) {
  const cost = formatCostEstimate(costEstimate);
  const checklist = [
    { label: "I spotted the brand", done: hasBrand },
    { label: "I suggested a category", done: hasCategory },
    { label: "I wrote the description", done: hasHtml },
    { label: "CSV fields are prepared", done: true },
    { label: "Photos are organized", done: imagesOrganized },
  ];

  return (
    <div className="mx-auto max-w-xl animate-in fade-in slide-in-from-bottom-2 duration-500 py-10">
      <p className="text-sm font-medium text-zinc-500">Higlou AI</p>
      <h2 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">
        I prepared your listing.
      </h2>
      <p className="mt-3 text-base text-zinc-600">
        I analyzed {photoCount} photo{photoCount === 1 ? "" : "s"}
        {productName ? ` of ${productName}` : ""} and drafted the essentials.
        {attentionCount > 0
          ? ` Only ${attentionCount} thing${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} a quick look.`
          : " Everything looks solid — review your eBay draft next."}
      </p>

      <ul className="mt-8 space-y-3">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-3 text-sm">
            <span
              className={
                item.done
                  ? "flex size-6 items-center justify-center rounded-full bg-emerald-500 text-white"
                  : "flex size-6 items-center justify-center rounded-full bg-zinc-200 text-zinc-500"
              }
            >
              <Check className="size-3.5" strokeWidth={3} />
            </span>
            <span className={item.done ? "text-zinc-900" : "text-zinc-500"}>
              {item.label}
            </span>
          </li>
        ))}
      </ul>

      <dl className="mt-8 grid grid-cols-3 gap-4 border-t border-zinc-200 pt-6 text-sm">
        <div>
          <dt className="text-zinc-500">Est. cost</dt>
          <dd className="mt-1 font-medium text-zinc-950">{cost ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-zinc-500">Time</dt>
          <dd className="mt-1 font-medium text-zinc-950">
            {estimateAnalysisMinutes(photoCount)}
          </dd>
        </div>
        <div>
          <dt className="text-zinc-500">Confidence</dt>
          <dd className="mt-1 font-medium text-zinc-950">
            {confidence >= 0.85
              ? "High"
              : confidence >= 0.55
                ? "Good"
                : confidence > 0
                  ? "Review"
                  : "—"}
          </dd>
        </div>
      </dl>

      <Button
        size="lg"
        onClick={onReview}
        className="mt-10 h-12 w-full rounded-xl bg-zinc-950 text-base font-medium text-white hover:bg-zinc-800 sm:w-auto sm:px-8"
      >
        Review listing
        <ArrowRight className="ml-2 size-4" />
      </Button>
    </div>
  );
}

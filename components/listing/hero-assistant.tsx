"use client";

import { Check, ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AnalysisCostEstimate } from "@/components/listing/analysis-cost-panel";
import {
  estimateAnalysisMinutes,
  formatCostEstimate,
} from "@/components/listing/review-helpers";

export function HeroAssistant({
  productName,
  photoCount,
  attentionCount,
  confidence,
  costEstimate,
  checklist,
  onReviewNow,
}: {
  productName?: string;
  photoCount: number;
  attentionCount: number;
  confidence: number;
  costEstimate: AnalysisCostEstimate | null;
  checklist: { label: string; done: boolean }[];
  onReviewNow: () => void;
}) {
  const cost = formatCostEstimate(costEstimate);

  return (
    <section className="animate-in fade-in slide-in-from-top-2 duration-500 pb-8">
      <p className="text-sm font-medium text-zinc-500">Higlou AI</p>
      <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950 sm:text-3xl">
        Your listing is almost ready.
      </h2>
      <p className="mt-2 max-w-2xl text-sm text-zinc-600">
        {productName
          ? `I wrote the title and filled in the draft for ${productName} from ${photoCount} photo${photoCount === 1 ? "" : "s"}.`
          : `I wrote the title and filled in the draft from ${photoCount} photo${photoCount === 1 ? "" : "s"}.`}{" "}
        {attentionCount > 0
          ? `Only ${attentionCount} thing${attentionCount === 1 ? "" : "s"} need${attentionCount === 1 ? "s" : ""} you.`
          : "Everything looks good — export whenever you’re ready."}
      </p>

      <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
        {checklist.map((item) => (
          <li
            key={item.label}
            className="inline-flex items-center gap-1.5 text-sm text-zinc-700"
          >
            <Check
              className={
                item.done ? "size-3.5 text-emerald-600" : "size-3.5 text-zinc-300"
              }
              strokeWidth={3}
            />
            {item.label}
          </li>
        ))}
      </ul>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        {attentionCount > 0 ? (
          <Button
            onClick={onReviewNow}
            className="rounded-xl bg-zinc-950 px-5 text-white hover:bg-zinc-800"
          >
            Review Now
            <ArrowDown className="ml-2 size-4" />
          </Button>
        ) : null}
        <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
          <span>
            Confidence{" "}
            <strong className="font-medium text-zinc-800">
              {confidence > 0 ? `${Math.round(confidence * 100)}%` : "—"}
            </strong>
          </span>
          <span>
            Est. cost{" "}
            <strong className="font-medium text-zinc-800">{cost ?? "—"}</strong>
          </span>
          <span>
            Time{" "}
            <strong className="font-medium text-zinc-800">
              {estimateAnalysisMinutes(photoCount)}
            </strong>
          </span>
        </div>
      </div>
    </section>
  );
}

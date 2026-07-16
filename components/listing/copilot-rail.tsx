"use client";

import { Check, Download, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ValidationChecklist } from "@/components/validation/validation-checklist";
import { AnalysisCostPanel } from "@/components/listing/analysis-cost-panel";
import type { AnalysisCostEstimate } from "@/components/listing/analysis-cost-panel";
import type { ValidationItem } from "@/components/validation/validation-checklist";
import type { ConfidenceStatus } from "@/lib/ai/confidence-engine";
import {
  formatCostEstimate,
  type AttentionField,
} from "@/components/listing/review-helpers";
import { cn } from "@/lib/utils";

type FieldConfidence = Record<
  string,
  { status: ConfidenceStatus; sources: string[]; confidence: number }
>;

export function CopilotRail({
  productLabel,
  confidence,
  fieldConfidence,
  attentionFields,
  issueLabels,
  costEstimate,
  validationItems,
  blocked,
  validated,
  exportDisabled,
  exportDisabledReason,
  lastCacheHit,
  budgetWarning,
  onExport,
  onSearchAgain,
  onStartNew,
}: {
  productLabel: string;
  confidence: number;
  fieldConfidence: FieldConfidence;
  attentionFields: AttentionField[];
  issueLabels: string[];
  costEstimate: AnalysisCostEstimate | null;
  validationItems: ValidationItem[];
  blocked: boolean;
  validated: boolean;
  exportDisabled: boolean;
  exportDisabledReason?: string;
  lastCacheHit: boolean;
  budgetWarning: string | null;
  onExport: () => void;
  onSearchAgain?: () => void;
  onStartNew: () => void;
}) {
  const ready = !blocked && attentionFields.length === 0;
  const cost = formatCostEstimate(costEstimate);
  const evidenceKeys = [
    { key: "brand", label: "Brand" },
    { key: "mpn", label: "MPN" },
    { key: "upc", label: "UPC" },
    { key: "model", label: "Model" },
  ] as const;

  const confirmed = evidenceKeys.filter(
    (item) => fieldConfidence[item.key]?.status === "confirmed",
  );
  const missing = evidenceKeys.filter((item) => {
    const status = fieldConfidence[item.key]?.status;
    return status === "empty" || status === "review" || !status;
  });

  return (
    <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
      <div
        className={cn(
          "rounded-2xl border bg-white p-5 animate-in fade-in slide-in-from-right-2 duration-500",
          ready ? "border-emerald-200" : "border-zinc-200",
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wide text-zinc-500">
              {ready ? "Listing Ready" : "Needs Attention"}
            </p>
            <p className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
              {confidence > 0 ? `${Math.round(confidence * 100)}` : "—"}
              {confidence > 0 ? (
                <span className="text-base font-medium text-zinc-400">%</span>
              ) : null}
            </p>
          </div>
          {ready ? (
            <span className="flex size-8 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check className="size-4" strokeWidth={3} />
            </span>
          ) : null}
        </div>

        <p className="mt-3 text-sm text-zinc-600">
          {ready
            ? "Ready to export"
            : `${issueLabels.length || attentionFields.length} issue${(issueLabels.length || attentionFields.length) === 1 ? "" : "s"}`}
        </p>

        {issueLabels.length > 0 ? (
          <ul className="mt-3 space-y-1.5 text-xs text-zinc-600">
            {issueLabels.slice(0, 4).map((label) => (
              <li key={label} className="flex gap-2">
                <span className="mt-1 size-1.5 shrink-0 rounded-full bg-[#f4c928]" />
                {label}
              </li>
            ))}
          </ul>
        ) : null}

        <dl className="mt-4 space-y-2 border-t border-zinc-100 pt-4 text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-zinc-500">Estimated cost</dt>
            <dd className="font-medium text-zinc-900">{cost ?? "—"}</dd>
          </div>
        </dl>

        <Button
          onClick={onExport}
          disabled={exportDisabled}
          title={exportDisabledReason || "Generate official eBay draft CSV"}
          className="mt-5 h-11 w-full rounded-xl bg-zinc-950 text-white hover:bg-zinc-800"
        >
          <Download className="mr-2 size-4" />
          Export CSV
        </Button>

        {validated && blocked ? (
          <p className="mt-3 text-xs text-red-600">
            Fix critical issues before exporting.
          </p>
        ) : null}
        {exportDisabledReason ? (
          <p className="mt-2 text-xs text-zinc-500">{exportDisabledReason}</p>
        ) : null}

        <details className="mt-4">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 hover:text-zinc-800">
            View Validation
          </summary>
          <div className="mt-3">
            <ValidationChecklist items={validationItems} />
          </div>
        </details>
      </div>

      <div className="rounded-2xl border border-zinc-200 bg-white p-5">
        <p className="text-sm font-medium text-zinc-950">Higlou AI</p>
        <p className="mt-3 text-sm leading-relaxed text-zinc-600">
          I identified this as{" "}
          <span className="font-medium text-zinc-900">
            {productLabel || "something I'm still figuring out"}
          </span>
          .
          {confidence > 0
            ? ` I'm about ${Math.round(confidence * 100)}% confident.`
            : ""}
          {ready
            ? " Ready when you are."
            : attentionFields.length === 1
              ? " Only one thing needs you."
              : attentionFields.length > 1
                ? ` ${attentionFields.length} things need a quick look.`
                : ""}
        </p>

        <div className="mt-4 space-y-2 text-xs">
          {confirmed.length > 0 ? (
            <p className="text-emerald-700">
              Evidence ✔ {confirmed.map((c) => c.label).join(" · ")}
            </p>
          ) : null}
          {missing.length > 0 ? (
            <p className="text-amber-800">
              Couldn&apos;t confirm ⚠ {missing.map((m) => m.label).join(" · ")}
            </p>
          ) : null}
        </div>

        {onSearchAgain ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="mt-4 rounded-lg"
            onClick={onSearchAgain}
          >
            <RefreshCw className="size-3.5" />
            Search Again
          </Button>
        ) : null}

        {lastCacheHit ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
            Served from cache — paid APIs were skipped.
          </p>
        ) : null}
        {budgetWarning ? (
          <p className="mt-3 text-xs text-amber-800">{budgetWarning}</p>
        ) : null}

        <div className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          <AnalysisCostPanel estimate={costEstimate} />
          <Button
            variant="ghost"
            size="sm"
            className="w-full rounded-lg text-zinc-500"
            onClick={onStartNew}
          >
            Start New Product
          </Button>
        </div>
      </div>
    </aside>
  );
}

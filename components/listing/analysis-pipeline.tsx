"use client";

import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

/** Visual pipeline substages during analysis. */
export const VISUAL_PIPELINE_STEPS = [
  "Checking images",
  "Scanning barcodes",
  "Reading labels",
  "Building listing",
  "Preparing HTML",
] as const;

export function mapAnalysisStepToPipeline(step: number, total: number) {
  if (total <= 1) return 0;
  const ratio = Math.min(1, Math.max(0, step / (total - 1)));
  return Math.min(
    VISUAL_PIPELINE_STEPS.length - 1,
    Math.floor(ratio * (VISUAL_PIPELINE_STEPS.length - 1)),
  );
}

export function AnalysisPipeline({
  activeIndex,
  complete = false,
  subtitle,
}: {
  activeIndex: number;
  complete?: boolean;
  subtitle?: string;
}) {
  return (
    <div className="animate-in fade-in duration-500 py-4">
      <p className="text-sm font-medium text-zinc-500">Higlou AI</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
        Working on your listing
      </h3>
      {subtitle ? (
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      ) : (
        <p className="mt-1 text-sm text-zinc-500">
          Hang tight — this usually takes under a minute.
        </p>
      )}
      <ul className="mt-8 space-y-1">
        {VISUAL_PIPELINE_STEPS.map((label, index) => {
          const done = complete || index < activeIndex;
          const current = !complete && index === activeIndex;
          const pending = !done && !current;
          return (
            <li
              key={label}
              className={cn(
                "flex items-center gap-3 rounded-xl px-2 py-2.5 transition-opacity duration-300",
                pending && "opacity-40",
              )}
            >
              <span
                className={cn(
                  "flex size-7 items-center justify-center rounded-full",
                  done && "bg-emerald-500 text-white",
                  current && "bg-zinc-950 text-white",
                  pending && "bg-zinc-100 text-zinc-400",
                )}
              >
                {done ? (
                  <Check className="size-3.5" strokeWidth={3} />
                ) : current ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Circle className="size-3" />
                )}
              </span>
              <span
                className={cn(
                  "text-sm font-medium",
                  current ? "text-zinc-950" : "text-zinc-600",
                )}
              >
                {label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

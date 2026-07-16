"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WorkspacePhase } from "@/components/listing/review-helpers";

const STEPS = ["Photos", "Analyzing", "Review", "Export"] as const;

function phaseToIndex(phase: WorkspacePhase, exported: boolean): number {
  if (exported) return 3;
  switch (phase) {
    case "uploading":
      return 0;
    case "analyzing":
      return 1;
    case "analysisComplete":
    case "reviewing":
      return 2;
    default:
      return 0;
  }
}

export function ListingProgress({
  phase,
  exported = false,
  analyzingLabel,
}: {
  phase: WorkspacePhase;
  exported?: boolean;
  analyzingLabel?: string;
}) {
  const active = phaseToIndex(phase, exported);

  return (
    <nav
      aria-label="Listing progress"
      className="mb-8 animate-in fade-in duration-500"
    >
      <ol className="flex items-center gap-1 sm:gap-2">
        {STEPS.map((label, index) => {
          const done = index < active || (exported && index <= 3 && index < 3);
          const current = index === active && !exported;
          const exportDone = exported && index === 3;
          const isDone = done || exportDone;

          return (
            <li key={label} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-all duration-300",
                    isDone && "bg-emerald-500 text-white",
                    current && "bg-zinc-950 text-white scale-105",
                    !isDone && !current && "bg-zinc-200 text-zinc-500",
                  )}
                >
                  {isDone ? <Check className="size-3.5" strokeWidth={3} /> : index + 1}
                </span>
                <span
                  className={cn(
                    "truncate text-xs font-medium sm:text-sm",
                    current || isDone ? "text-zinc-950" : "text-zinc-400",
                  )}
                >
                  {label}
                  {current && label === "Analyzing" && analyzingLabel ? (
                    <span className="hidden text-zinc-500 sm:inline">
                      {" "}
                      · {analyzingLabel}
                    </span>
                  ) : null}
                </span>
              </div>
              {index < STEPS.length - 1 ? (
                <div
                  className={cn(
                    "mx-1 hidden h-px flex-1 sm:block",
                    index < active || exported ? "bg-emerald-400" : "bg-zinc-200",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

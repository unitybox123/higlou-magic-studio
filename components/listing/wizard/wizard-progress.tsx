"use client";

import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  WIZARD_PROGRESS_STEPS,
  wizardStepToProgressIndex,
  type WizardStep,
} from "@/components/listing/wizard/types";

const STEP_SUB: Record<(typeof WIZARD_PROGRESS_STEPS)[number]["id"], string> = {
  photos: "",
  analyzing: "Analyzing your product…",
  review: "Confirm your eBay draft",
  export: "Review your listing",
};

export function WizardProgress({
  step,
  exported = false,
  className,
}: {
  step: WizardStep;
  exported?: boolean;
  className?: string;
}) {
  const lastIndex = WIZARD_PROGRESS_STEPS.length - 1;
  const active = exported ? lastIndex : wizardStepToProgressIndex(step);

  return (
    <nav
      aria-label="Listing progress"
      className={cn("mx-auto hidden items-center gap-1 md:flex", className)}
    >
      {WIZARD_PROGRESS_STEPS.map((item, i) => {
        const resolved: "done" | "active" | "todo" = exported
          ? i < lastIndex
            ? "done"
            : "active"
          : i < active
            ? "done"
            : i === active
              ? "active"
              : "todo";

        return (
          <div key={item.id} className="flex items-center gap-1">
            {i > 0 ? (
              <ChevronRight className="mx-0.5 h-3.5 w-3.5 text-muted-foreground/50" />
            ) : null}
            <div
              className={cn(
                "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                resolved === "done" && "text-muted-foreground",
                resolved === "active" && "bg-brand-soft text-brand-foreground",
                resolved === "todo" && "text-muted-foreground/55",
              )}
            >
              <span
                className={cn(
                  "grid size-4 place-items-center rounded-full text-[10px]",
                  resolved === "done" && "bg-success-soft text-success",
                  resolved === "active" && "bg-brand text-brand-foreground",
                  resolved === "todo" && "bg-muted text-muted-foreground",
                )}
              >
                {resolved === "done" ? (
                  <Check className="size-2.5" strokeWidth={3} />
                ) : (
                  i + 1
                )}
              </span>
              <span className="hidden lg:inline">{item.label}</span>
            </div>
          </div>
        );
      })}
      {STEP_SUB[WIZARD_PROGRESS_STEPS[active]?.id ?? "photos"] ? (
        <span className="ml-2 hidden text-[11px] text-muted-foreground xl:inline">
          {STEP_SUB[WIZARD_PROGRESS_STEPS[active]?.id ?? "photos"]}
        </span>
      ) : null}
    </nav>
  );
}

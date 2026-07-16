"use client";

import { HelpCircle } from "lucide-react";
import { toast } from "sonner";
import { HiglouMark } from "@/components/listing/wizard/higlou-mark";
import { WizardProgress } from "@/components/listing/wizard/wizard-progress";
import type { WizardStep } from "@/components/listing/wizard/types";
import { cn } from "@/lib/utils";

export function WizardShell({
  step,
  exported = false,
  children,
  headerActions,
  className,
  flush = false,
}: {
  step: WizardStep;
  exported?: boolean;
  children: React.ReactNode;
  /** Optional actions (e.g. Save Draft) shown near help on later steps */
  headerActions?: React.ReactNode;
  className?: string;
  /** When true, main has no max-width padding (screens that manage their own layout). */
  flush?: boolean;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-surface/85 backdrop-blur-lg">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center gap-6 px-6">
          <HiglouMark className="shrink-0" />

          <WizardProgress step={step} exported={exported} />

          <div className="ml-auto flex items-center gap-2">
            {headerActions}
            <button
              type="button"
              className="ml-auto inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-xs transition-colors hover:bg-muted"
              onClick={() =>
                toast.message("Need help?", {
                  description:
                    "Questions while listing? Open Home from the Higlou logo anytime.",
                })
              }
            >
              <HelpCircle className="h-4 w-4" />
              Need help?
            </button>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "flex-1",
          flush
            ? "w-full"
            : "mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 sm:py-8",
          className,
        )}
      >
        {children}
      </main>
    </div>
  );
}

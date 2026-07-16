"use client";

import { AnalysisPipeline } from "@/components/listing/analysis-pipeline";
import { WizardFrame } from "@/components/listing/wizard/wizard-frame";
import { Button } from "@/components/ui/button";

export function AnalyzingScreen({
  activeIndex,
  analysisError,
  onCancel,
  onRetry,
}: {
  activeIndex: number;
  analysisError?: string | null;
  onCancel?: () => void;
  onRetry?: () => void;
}) {
  return (
    <WizardFrame step="analyzing">
      <div className="mx-auto w-full max-w-md space-y-8 py-4">
        <AnalysisPipeline
          activeIndex={activeIndex}
          complete={false}
          subtitle="Sit back — I’m reading your photos and drafting the listing."
        />

        {analysisError ? (
          <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50/80 px-4 py-4">
            <p className="text-sm text-red-700">{analysisError}</p>
            <div className="flex flex-wrap gap-2">
              {onRetry ? (
                <Button
                  size="sm"
                  onClick={onRetry}
                  className="rounded-xl bg-zinc-950 text-white hover:bg-zinc-800"
                >
                  Try again
                </Button>
              ) : null}
              {onCancel ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancel}
                  className="rounded-xl"
                >
                  Back to photos
                </Button>
              ) : null}
            </div>
          </div>
        ) : onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="text-sm text-zinc-400 transition hover:text-zinc-600"
          >
            Cancel
          </button>
        ) : null}
      </div>
    </WizardFrame>
  );
}

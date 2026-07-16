"use client";

import { cn } from "@/lib/utils";
import { usePrefersReducedMotion } from "@/components/listing/wizard/use-prefers-reduced-motion";
import type { WizardStep } from "@/components/listing/wizard/types";

export function WizardFrame({
  step,
  children,
  className,
  centered = true,
}: {
  step: WizardStep;
  children: React.ReactNode;
  className?: string;
  /** Vertically center content in the viewport stage */
  centered?: boolean;
}) {
  const reduceMotion = usePrefersReducedMotion();

  return (
    <div
      key={step}
      className={cn(
        "mx-auto flex w-full max-w-2xl flex-col",
        centered && "min-h-[min(72vh,720px)] justify-center",
        !reduceMotion &&
          "animate-in fade-in slide-in-from-right-3 duration-500 fill-mode-both",
        className,
      )}
    >
      {children}
    </div>
  );
}

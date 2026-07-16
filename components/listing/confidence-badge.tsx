"use client";

import { cn } from "@/lib/utils";
import type { ConfidenceStatus } from "@/lib/ai/confidence-engine";

export function ConfidenceBadge({
  status,
  sources,
  confidence,
  className,
}: {
  status: ConfidenceStatus;
  sources?: string[];
  confidence?: number;
  className?: string;
}) {
  const label =
    status === "confirmed"
      ? "Confirmed"
      : status === "review"
        ? "Review"
        : "Not enough evidence";
  const sourceText = sources?.length ? sources.join(" + ") : null;

  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center gap-1.5 truncate rounded-full px-2 py-0.5 text-[11px] font-medium",
        status === "confirmed" && "bg-emerald-50 text-emerald-800",
        status === "review" && "bg-amber-50 text-amber-800",
        status === "empty" && "bg-zinc-100 text-zinc-500",
        className,
      )}
      title={
        typeof confidence === "number"
          ? `${Math.round(confidence * 100)}% · ${sourceText || status}`
          : sourceText || label
      }
    >
      <span
        className={cn(
          "size-1.5 shrink-0 rounded-full",
          status === "confirmed" && "bg-emerald-500",
          status === "review" && "bg-amber-400",
          status === "empty" && "bg-zinc-400",
        )}
      />
      {label}
      {sourceText && status !== "empty" ? (
        <span className="truncate opacity-80">· {sourceText}</span>
      ) : null}
    </span>
  );
}

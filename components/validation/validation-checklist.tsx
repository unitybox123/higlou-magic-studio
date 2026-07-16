"use client";

import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

export type ValidationSeverity = "critical" | "warning" | "info";

export interface ValidationItem {
  id: string;
  label: string;
  ok: boolean;
  severity: ValidationSeverity;
  detail?: string;
}

export function ValidationChecklist({ items }: { items: ValidationItem[] }) {
  return (
    <div className="space-y-3">
      {items.map((item) => {
        const Icon = item.ok
          ? CheckCircle2
          : item.severity === "critical"
            ? AlertCircle
            : Info;
        return (
          <Alert
            key={item.id}
            className={cn(
              "border",
              item.ok
                ? "border-emerald-200 bg-emerald-50"
                : item.severity === "critical"
                  ? "border-red-200 bg-red-50"
                  : "border-amber-200 bg-amber-50",
            )}
          >
            <Icon className="size-4" />
            <AlertTitle className="text-sm">{item.label}</AlertTitle>
            {item.detail ? (
              <AlertDescription>{item.detail}</AlertDescription>
            ) : null}
          </Alert>
        );
      })}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type CostDashboard = {
  disclaimer: string;
  status: "ok" | "warning" | "high_warning" | "over_limit";
  percentOfBudgetUsed: number;
  budget: {
    monthlyProductTarget: number;
    monthlyBudgetWarningUsd: number;
    monthlyBudgetLimitUsd: number;
    enforcementMode: string;
  };
  snapshot: {
    productsProcessed: number;
    openAICost: number;
    googleVisionCost: number;
    zxingScans: number;
    inputTokens: number;
    outputTokens: number;
    cachedInputTokens: number;
    ocrUnits: number;
    cacheHits: number;
    retries: number;
    imagesAnalyzed: number;
  };
  projection: {
    estimatedAiCostToDate: number;
    estimatedInfrastructure: number;
    estimatedTotalToDate: number;
    averageCostPerProduct: number;
    projectedMonthEndTotal: number;
    productsRemainingToTarget: number;
  };
  averageProductCost: {
    estimatedProductCost: number;
    disclaimer: string;
  } | null;
};

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

function pct(n: number) {
  return `${(n * 100).toFixed(0)}%`;
}

function statusLabel(status: CostDashboard["status"]) {
  switch (status) {
    case "warning":
      return "Warning (~75%)";
    case "high_warning":
      return "High warning (~90%)";
    case "over_limit":
      return "At / over target";
    default:
      return "On track";
  }
}

export default function UsageCostsPage() {
  const [data, setData] = useState<CostDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/costs")
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load cost dashboard");
        const json = (await res.json()) as CostDashboard;
        if (!cancelled) setData(json);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      title="Usage & costs"
      description="What Higlou AI spent this month — estimates only, not an invoice."
      actions={
        <a
          href="/settings"
          className="inline-flex h-9 items-center text-sm font-medium text-zinc-500 hover:text-zinc-950"
        >
          ← Settings
        </a>
      }
    >
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
      {!data && !error ? (
        <p className="text-sm text-zinc-500">Loading estimated usage…</p>
      ) : null}
      {data ? (
        <div className="space-y-4">
          <p className="text-sm text-zinc-600">{data.disclaimer}</p>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">{statusLabel(data.status)}</Badge>
            <span className="text-sm text-zinc-600">
              {data.percentOfBudgetUsed.toFixed(0)}% of $
              {data.budget.monthlyBudgetLimitUsd} target
            </span>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Products processed"
              value={`${data.snapshot.productsProcessed} / ${data.budget.monthlyProductTarget}`}
            />
            <Metric
              label="Products remaining"
              value={String(data.projection.productsRemainingToTarget)}
            />
            <Metric
              label="Estimated AI cost"
              value={money(data.projection.estimatedAiCostToDate)}
            />
            <Metric
              label="Estimated infrastructure"
              value={money(data.projection.estimatedInfrastructure)}
            />
            <Metric
              label="Estimated total"
              value={money(data.projection.estimatedTotalToDate)}
            />
            <Metric
              label="Avg cost / product"
              value={
                data.snapshot.productsProcessed > 0
                  ? money(data.projection.averageCostPerProduct)
                  : "—"
              }
            />
            <Metric
              label="Projected month-end"
              value={money(data.projection.projectedMonthEndTotal)}
            />
            <Metric
              label="Budget limit"
              value={money(data.budget.monthlyBudgetLimitUsd)}
            />
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card className="rounded-2xl border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Usage this month</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-700">
                <Row label="Images analyzed" value={data.snapshot.imagesAnalyzed} />
                <Row label="OpenAI input tokens" value={data.snapshot.inputTokens} />
                <Row label="OpenAI output tokens" value={data.snapshot.outputTokens} />
                <Row
                  label="OpenAI cached tokens"
                  value={data.snapshot.cachedInputTokens}
                />
                <Row label="Google Vision OCR units" value={data.snapshot.ocrUnits} />
                <Row label="ZXing successful scans" value={data.snapshot.zxingScans} />
                <Row label="Cache hits" value={data.snapshot.cacheHits} />
                <Row label="Retries" value={data.snapshot.retries} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-zinc-200 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Cost breakdown (estimated)</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-zinc-700">
                <Row label="OpenAI" value={money(data.snapshot.openAICost)} />
                <Row
                  label="Google Vision"
                  value={money(data.snapshot.googleVisionCost)}
                />
                <Row
                  label="Fixed infra (allocated)"
                  value={money(data.projection.estimatedInfrastructure)}
                />
                <p className="pt-2 text-xs text-zinc-500">
                  Infrastructure is an internal allocation estimate (Supabase + Vercel +
                  misc). Provider rates are editable via env and provider_pricing_settings.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : null}
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <Card className="rounded-2xl border-zinc-200 shadow-sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-zinc-500">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold text-zinc-900">{value}</CardContent>
    </Card>
  );
}

function Row({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="font-medium text-zinc-900">{value}</span>
    </div>
  );
}

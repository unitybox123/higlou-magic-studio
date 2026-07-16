"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Barcode,
  Check,
  ChevronDown,
  Eye,
  FileSpreadsheet,
  Loader2,
  Palette,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type AiProviderSettings = {
  openaiEnabled: boolean;
  googleVisionEnabled: boolean;
  barcodeEnabled: boolean;
  googleVisionMode: "off" | "fallback" | "always";
  googleVisionMaxImages: number;
  documentTextFallback: boolean;
  allowImproveOcr: boolean;
  maxAnalysisImages: number;
  minConfidence: number;
  barcodeEnhancedContrast: boolean;
  barcodeTryRotation: boolean;
  preferBarcodeOverOcr: boolean;
  validateUpcEanChecksum: boolean;
  /** Commercial UX: automatic hides technical decisions */
  analysisMode: "automatic" | "custom";
};

export const AI_SETTINGS_STORAGE_KEY = "higlou-ai-settings";

const DEFAULTS: AiProviderSettings = {
  openaiEnabled: true,
  googleVisionEnabled: true,
  barcodeEnabled: true,
  googleVisionMode: "fallback",
  googleVisionMaxImages: 4,
  documentTextFallback: true,
  allowImproveOcr: true,
  maxAnalysisImages: 12,
  minConfidence: 0.6,
  barcodeEnhancedContrast: true,
  barcodeTryRotation: true,
  preferBarcodeOverOcr: true,
  validateUpcEanChecksum: true,
  analysisMode: "automatic",
};

type ServiceCard = {
  id: string;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
  status: "connected" | "ready" | "missing" | "checking";
};

type HealthResponse = {
  ok: boolean;
  summary: string;
  checks: Array<{
    id: string;
    label: string;
    status: "ok" | "warn" | "fail";
    detail: string;
  }>;
};

type CostsSnapshot = {
  snapshot?: {
    productsProcessed: number;
    openAICost: number;
    googleVisionCost: number;
    ocrUnits: number;
  };
  budget?: { monthlyProductTarget: number };
  projection?: { estimatedAiCostToDate: number };
};

export function readAiProviderSettings(): AiProviderSettings {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(AI_SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = { ...DEFAULTS, ...JSON.parse(raw) } as AiProviderSettings;
    if (parsed.analysisMode === "automatic") {
      return {
        ...parsed,
        openaiEnabled: true,
        googleVisionEnabled: true,
        barcodeEnabled: true,
        googleVisionMode: "fallback",
      };
    }
    return parsed;
  } catch {
    return DEFAULTS;
  }
}

function money(n: number) {
  return `$${n.toFixed(2)}`;
}

export function AiSettingsForm() {
  const [settings, setSettings] = useState<AiProviderSettings>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [costs, setCosts] = useState<CostsSnapshot | null>(null);
  const [csvCount, setCsvCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        setSettings(readAiProviderSettings());
        setHydrated(true);
      }
    });

    void fetch("/api/costs")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        setCosts((await res.json()) as CostsSnapshot);
      })
      .catch(() => undefined);

    void fetch("/api/csv-history")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as { files?: unknown[] };
        if (!cancelled) setCsvCount(body.files?.length ?? 0);
      })
      .catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const serviceCards: ServiceCard[] = useMemo(() => {
    const byId = new Map(health?.checks.map((c) => [c.id, c]) ?? []);
    const mapStatus = (
      id: string,
      fallback: ServiceCard["status"],
    ): ServiceCard["status"] => {
      if (healthLoading && !health) return "checking";
      const check = byId.get(id);
      if (!check) return fallback;
      if (check.status === "ok") return id === "barcode" ? "ready" : "connected";
      if (check.status === "warn") return "ready";
      return "missing";
    };

    return [
      {
        id: "openai",
        title: "OpenAI",
        subtitle: "Understands products & writes listings",
        icon: Sparkles,
        status: mapStatus("openai", "connected"),
      },
      {
        id: "google_vision",
        title: "Text Recognition",
        subtitle: "Reads labels and packaging text",
        icon: Eye,
        status: mapStatus("google_vision", "connected"),
      },
      {
        id: "barcode",
        title: "Barcode Scanner",
        subtitle: "Reads UPC / EAN codes locally",
        icon: Barcode,
        status: mapStatus("barcode", "ready"),
      },
      {
        id: "template",
        title: "CSV Template",
        subtitle: "Official eBay draft format",
        icon: FileSpreadsheet,
        status: mapStatus("template", "ready"),
      },
      {
        id: "branding",
        title: "Store Branding",
        subtitle: "Higlou Store presentation",
        icon: Palette,
        status: mapStatus("branding", "ready"),
      },
    ];
  }, [health, healthLoading]);

  const overallReady = useMemo(() => {
    if (!health) return true;
    return health.checks
      .filter((c) => ["openai", "supabase", "template", "env"].includes(c.id))
      .every((c) => c.status === "ok");
  }, [health]);

  const save = (next?: AiProviderSettings) => {
    const value = next ?? settings;
    localStorage.setItem(AI_SETTINGS_STORAGE_KEY, JSON.stringify(value));
    setSettings(value);
    toast.success("AI preferences saved");
  };

  const setAutomatic = () => {
    const next: AiProviderSettings = {
      ...settings,
      analysisMode: "automatic",
      openaiEnabled: true,
      googleVisionEnabled: true,
      barcodeEnabled: true,
      googleVisionMode: "fallback",
      documentTextFallback: true,
      allowImproveOcr: true,
    };
    save(next);
  };

  const runHealthCheck = async () => {
    setHealthLoading(true);
    try {
      const res = await fetch("/api/system/health");
      const body = (await res.json()) as HealthResponse;
      if (!res.ok) {
        toast.error("System check failed to run");
        return;
      }
      setHealth(body);
      toast.success(body.summary);
    } catch {
      toast.error("System check failed to run");
    } finally {
      setHealthLoading(false);
    }
  };

  if (!hydrated) {
    return <p className="text-sm text-zinc-500">Loading AI analysis…</p>;
  }

  const products = costs?.snapshot?.productsProcessed ?? 0;
  const target = costs?.budget?.monthlyProductTarget ?? 500;
  const aiCost = costs?.projection?.estimatedAiCostToDate ?? 0;
  const ocrUnits = costs?.snapshot?.ocrUnits ?? 0;
  const timeSavedHours = Number((products * 0.25).toFixed(1));

  return (
    <div className="space-y-8">
      {/* Hero summary */}
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/80 bg-gradient-to-br from-zinc-50 via-white to-[#fff9e6] p-6 sm:p-8">
        <div className="absolute -right-10 -top-10 size-40 rounded-full bg-[#f4c928]/20 blur-3xl" />
        <div className="relative space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-[0.18em] text-zinc-500">
                AI ANALYSIS
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                Automatic by default
              </h2>
              <p className="mt-2 max-w-xl text-sm leading-relaxed text-zinc-600">
                The platform chooses the best service for every image — vision,
                text recognition, and barcode reading — so you can focus on
                selling.
              </p>
            </div>
            <div
              className={cn(
                "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium",
                overallReady
                  ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
                  : "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
              )}
            >
              <span
                className={cn(
                  "size-2 rounded-full",
                  overallReady ? "bg-emerald-500" : "bg-amber-500",
                )}
              />
              {overallReady ? "Ready" : "Needs attention"}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                {
                  title: "OpenAI Vision",
                  on: settings.openaiEnabled,
                },
                {
                  title: "Text Recognition",
                  on: settings.googleVisionEnabled,
                },
                {
                  title: "Barcode Scanner",
                  on: settings.barcodeEnabled,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-2 rounded-2xl bg-white/80 px-4 py-3 text-sm shadow-sm ring-1 ring-zinc-200/70"
              >
                <span
                  className={cn(
                    "flex size-5 items-center justify-center rounded-full",
                    item.on
                      ? "bg-emerald-500 text-white"
                      : "bg-zinc-200 text-zinc-500",
                  )}
                >
                  <Check className="size-3.5" strokeWidth={3} />
                </span>
                <span className="font-medium text-zinc-900">{item.title}</span>
              </div>
            ))}
          </div>

          <div className="rounded-2xl bg-white/70 p-4 ring-1 ring-zinc-200/70">
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Mode
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={setAutomatic}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  settings.analysisMode === "automatic"
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
              >
                Automatic
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = { ...settings, analysisMode: "custom" as const };
                  save(next);
                  setAdvancedOpen(true);
                }}
                className={cn(
                  "rounded-full px-4 py-2 text-sm font-medium transition",
                  settings.analysisMode === "custom"
                    ? "bg-zinc-950 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200",
                )}
              >
                Custom
              </button>
            </div>
            <p className="mt-3 text-sm text-zinc-600">
              {settings.analysisMode === "automatic"
                ? "Everything else stays hidden. The AI decides what each photo needs."
                : "Custom mode unlocks advanced controls below."}
            </p>
          </div>
        </div>
      </div>

      {/* Service cards */}
      <div>
        <h3 className="text-sm font-semibold text-zinc-900">AI Services</h3>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {serviceCards.map((card) => {
            const Icon = card.icon;
            return (
              <div
                key={card.id}
                className="group rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-zinc-950 text-[#f4c928]">
                    <Icon className="size-5" />
                  </div>
                  <StatusPill status={card.status} />
                </div>
                <p className="mt-4 text-base font-semibold text-zinc-950">
                  {card.title}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{card.subtitle}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* AI Status checklist */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <h3 className="text-sm font-semibold text-zinc-900">AI Status</h3>
        <ul className="mt-4 space-y-3">
          {(
            [
              ["openai", "OpenAI Connected"],
              ["google_vision", "Text Recognition Connected"],
              ["barcode", "Barcode Scanner Ready"],
              ["template", "Template Loaded"],
              ["branding", "Store Branding Ready"],
              ["env", "CSV Generator Ready"],
            ] as const
          ).map(([id, label]) => {
            const check = health?.checks.find((c) => c.id === id);
            const ok =
              !health || check?.status === "ok" || check?.status === "warn";
            return (
              <li key={id} className="flex items-center gap-3 text-sm">
                <span
                  className={cn(
                    "size-2.5 rounded-full",
                    ok ? "bg-emerald-500" : "bg-rose-500",
                  )}
                />
                <span className="text-zinc-800">{label}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Usage */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">This month</h3>
          <a
            href="/usage"
            className="text-xs font-medium text-zinc-500 hover:text-zinc-900"
          >
            View details
          </a>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <UsageTile
            label="Products analyzed"
            value={`${products} / ${target}`}
          />
          <UsageTile label="Estimated AI Cost" value={money(aiCost)} />
          <UsageTile label="Text Recognition" value={`${ocrUnits} Images`} />
          <UsageTile label="CSV Generated" value={String(csvCount)} />
          <UsageTile label="Time Saved" value={`${timeSavedHours} hours`} />
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          Estimates for platform operating costs only — not an invoice.
        </p>
      </div>

      {/* Health check */}
      <div className="rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900">System Check</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Verify that everything needed to create listings is online.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => void runHealthCheck()}
            disabled={healthLoading}
            className="rounded-full"
          >
            {healthLoading ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Checking…
              </>
            ) : (
              "Run System Check"
            )}
          </Button>
        </div>
        {health ? (
          <div className="mt-4 space-y-3">
            <p
              className={cn(
                "text-sm font-medium",
                health.ok ? "text-emerald-700" : "text-amber-700",
              )}
            >
              {health.summary}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {health.checks.map((check) => (
                <div
                  key={check.id}
                  className="flex items-start gap-3 rounded-2xl bg-zinc-50 px-3 py-2.5 text-sm"
                >
                  <span
                    className={cn(
                      "mt-1 size-2 shrink-0 rounded-full",
                      check.status === "ok"
                        ? "bg-emerald-500"
                        : check.status === "warn"
                          ? "bg-amber-400"
                          : "bg-rose-500",
                    )}
                  />
                  <div>
                    <p className="font-medium text-zinc-900">{check.label}</p>
                    <p className="text-xs text-zinc-500">{check.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      {/* Advanced */}
      <div className="rounded-3xl border border-zinc-200 bg-white shadow-sm">
        <button
          type="button"
          className="flex w-full items-center justify-between px-5 py-4 text-left"
          onClick={() => setAdvancedOpen((o) => !o)}
        >
          <div>
            <p className="text-sm font-semibold text-zinc-900">
              Advanced AI Settings
            </p>
            <p className="text-xs text-zinc-500">
              Optional. Most sellers never need this.
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-zinc-500 transition",
              advancedOpen && "rotate-180",
            )}
          />
        </button>
        {advancedOpen ? (
          <div className="space-y-5 border-t border-zinc-100 px-5 py-5">
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Providers
              </p>
              <ToggleRow
                label="OpenAI"
                checked={settings.openaiEnabled}
                onChange={(checked) =>
                  setSettings((s) => ({
                    ...s,
                    analysisMode: "custom",
                    openaiEnabled: checked,
                  }))
                }
              />
              <ToggleRow
                label="Text Recognition"
                checked={settings.googleVisionEnabled}
                onChange={(checked) =>
                  setSettings((s) => ({
                    ...s,
                    analysisMode: "custom",
                    googleVisionEnabled: checked,
                  }))
                }
              />
              <ToggleRow
                label="Barcode Scanner"
                checked={settings.barcodeEnabled}
                onChange={(checked) =>
                  setSettings((s) => ({
                    ...s,
                    analysisMode: "custom",
                    barcodeEnabled: checked,
                  }))
                }
              />
            </div>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Text Recognition Mode
              </p>
              {(
                [
                  {
                    value: "off" as const,
                    label: "Off",
                    hint: "Skip text recognition unless explicitly requested",
                  },
                  {
                    value: "fallback" as const,
                    label: "Smart (recommended)",
                    hint: "Used when labels or missing fields need help",
                  },
                  {
                    value: "always" as const,
                    label: "Always",
                    hint: "Run on selected images every time",
                  },
                ] as const
              ).map((option) => (
                <label
                  key={option.value}
                  className="flex cursor-pointer items-start gap-3 rounded-2xl border border-zinc-200 p-3 text-sm"
                >
                  <input
                    type="radio"
                    className="mt-1"
                    name="text-recognition-mode"
                    checked={settings.googleVisionMode === option.value}
                    onChange={() =>
                      setSettings((s) => ({
                        ...s,
                        analysisMode: "custom",
                        googleVisionMode: option.value,
                      }))
                    }
                  />
                  <span>
                    <span className="font-medium text-zinc-900">
                      {option.label}
                    </span>
                    <span className="mt-0.5 block text-xs text-zinc-500">
                      {option.hint}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label>Max text-recognition images</Label>
                <Input
                  type="number"
                  min={1}
                  max={8}
                  value={settings.googleVisionMaxImages}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      analysisMode: "custom",
                      googleVisionMaxImages: Number(e.target.value || 4),
                    }))
                  }
                />
              </div>
              <div className="space-y-1">
                <Label>Max photos sent to AI</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={settings.maxAnalysisImages}
                  onChange={(e) =>
                    setSettings((s) => ({
                      ...s,
                      analysisMode: "custom",
                      maxAnalysisImages: Number(e.target.value || 12),
                    }))
                  }
                />
              </div>
            </div>

            <ToggleRow
              label="Extra text-recognition fallback"
              checked={settings.documentTextFallback}
              onChange={(checked) =>
                setSettings((s) => ({
                  ...s,
                  analysisMode: "custom",
                  documentTextFallback: Boolean(checked),
                }))
              }
            />
            <ToggleRow
              label="Allow Improve Text button"
              checked={settings.allowImproveOcr}
              onChange={(checked) =>
                setSettings((s) => ({
                  ...s,
                  allowImproveOcr: Boolean(checked),
                }))
              }
            />
            <ToggleRow
              label="Prefer barcode when both match"
              checked={settings.preferBarcodeOverOcr}
              onChange={(checked) =>
                setSettings((s) => ({
                  ...s,
                  preferBarcodeOverOcr: Boolean(checked),
                }))
              }
            />
            <ToggleRow
              label="Validate barcode check digits"
              checked={settings.validateUpcEanChecksum}
              onChange={(checked) =>
                setSettings((s) => ({
                  ...s,
                  validateUpcEanChecksum: Boolean(checked),
                }))
              }
            />

            <Button type="button" onClick={() => save()} className="rounded-full">
              Save advanced settings
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function StatusPill({
  status,
}: {
  status: "connected" | "ready" | "missing" | "checking";
}) {
  const label =
    status === "connected"
      ? "Connected"
      : status === "ready"
        ? "Ready"
        : status === "checking"
          ? "Checking"
          : "Setup needed";
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-xs font-medium",
        status === "missing"
          ? "bg-rose-50 text-rose-700"
          : status === "checking"
            ? "bg-zinc-100 text-zinc-600"
            : "bg-emerald-50 text-emerald-700",
      )}
    >
      {label}
    </span>
  );
}

function UsageTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 px-4 py-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-zinc-950">{value}</p>
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-100 px-3 py-2.5">
      <Label className="text-sm text-zinc-800">{label}</Label>
      <Switch checked={checked} onCheckedChange={(v) => onChange(Boolean(v))} />
    </div>
  );
}

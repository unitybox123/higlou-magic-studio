"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type BudgetSettings = {
  monthlyProductTarget: number;
  monthlyBudgetWarningUsd: number;
  monthlyBudgetLimitUsd: number;
  enforcementMode:
    | "warn_only"
    | "require_admin_confirmation"
    | "block_advanced_analysis"
    | "block_all_new_ai_analysis";
  defaultAnalysisTier: "economy" | "advanced";
};

const DEFAULTS: BudgetSettings = {
  monthlyProductTarget: 500,
  monthlyBudgetWarningUsd: 75,
  monthlyBudgetLimitUsd: 100,
  enforcementMode: "warn_only",
  defaultAnalysisTier: "economy",
};

export function BudgetSettingsForm() {
  const [settings, setSettings] = useState<BudgetSettings>(DEFAULTS);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/settings/budget")
      .then(async (res) => {
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as BudgetSettings;
        if (!cancelled) setSettings({ ...DEFAULTS, ...data });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      const body = await res.json();
      if (!res.ok) {
        toast.error(body.error || "Failed to save budget settings");
        return;
      }
      setSettings({ ...DEFAULTS, ...body });
      toast.success("Budget settings saved");
    } catch {
      toast.error("Failed to save budget settings");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-zinc-600">
        Targets are operational estimates for platform AI + infrastructure spend.
        They are not invoices. Marketplace fees are excluded.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Monthly product target</Label>
          <Input
            type="number"
            value={settings.monthlyProductTarget}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                monthlyProductTarget: Number(e.target.value || 0),
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Warning budget (USD)</Label>
          <Input
            type="number"
            value={settings.monthlyBudgetWarningUsd}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                monthlyBudgetWarningUsd: Number(e.target.value || 0),
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Limit budget (USD)</Label>
          <Input
            type="number"
            value={settings.monthlyBudgetLimitUsd}
            onChange={(e) =>
              setSettings((s) => ({
                ...s,
                monthlyBudgetLimitUsd: Number(e.target.value || 0),
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label>Default analysis tier</Label>
          <Select
            value={settings.defaultAnalysisTier}
            onValueChange={(value) =>
              setSettings((s) => ({
                ...s,
                defaultAnalysisTier: value as BudgetSettings["defaultAnalysisTier"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="economy">Economy first</SelectItem>
              <SelectItem value="advanced">Advanced</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label>Budget enforcement</Label>
          <Select
            value={settings.enforcementMode}
            onValueChange={(value) =>
              setSettings((s) => ({
                ...s,
                enforcementMode: value as BudgetSettings["enforcementMode"],
              }))
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="warn_only">Warn only</SelectItem>
              <SelectItem value="require_admin_confirmation">
                Require admin confirmation
              </SelectItem>
              <SelectItem value="block_advanced_analysis">
                Block advanced analysis
              </SelectItem>
              <SelectItem value="block_all_new_ai_analysis">
                Block all new AI analysis
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button onClick={() => void save()} disabled={saving}>
        {saving ? "Saving…" : "Save budget settings"}
      </Button>
    </div>
  );
}

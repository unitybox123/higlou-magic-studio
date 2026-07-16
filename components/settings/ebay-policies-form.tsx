"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DEFAULT_VALUES } from "@/config/default-values";

type Policies = {
  paymentPolicyId: string;
  returnPolicyId: string;
  shippingPolicyId: string;
  defaultItemLocation: string;
  defaultPostalCode: string;
  defaultHandlingTime: number;
};

const emptyPolicies: Policies = {
  paymentPolicyId: "",
  returnPolicyId: "",
  shippingPolicyId: "",
  defaultItemLocation: DEFAULT_VALUES.itemLocation,
  defaultPostalCode: "",
  defaultHandlingTime: DEFAULT_VALUES.handlingTime,
};

export function EbayPoliciesForm() {
  const [policies, setPolicies] = useState<Policies>(emptyPolicies);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings/policies");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || "Failed to load policies");
        }
        const data = (await res.json()) as { policies: Policies };
        setPolicies(data.policies);
      } catch (error) {
        toast.message("Using empty policy defaults", {
          description:
            error instanceof Error ? error.message : "Could not load policies",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/policies", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(policies),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Save failed");
      }
      const data = (await res.json()) as { policies: Policies };
      setPolicies(data.policies);
      toast.success("eBay policies saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading policies…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Shipping policy ID</Label>
        <Input
          value={policies.shippingPolicyId}
          onChange={(e) =>
            setPolicies((prev) => ({
              ...prev,
              shippingPolicyId: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Return policy ID</Label>
        <Input
          value={policies.returnPolicyId}
          onChange={(e) =>
            setPolicies((prev) => ({
              ...prev,
              returnPolicyId: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Payment policy ID</Label>
        <Input
          value={policies.paymentPolicyId}
          onChange={(e) =>
            setPolicies((prev) => ({
              ...prev,
              paymentPolicyId: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Default item location</Label>
        <Input
          value={policies.defaultItemLocation}
          onChange={(e) =>
            setPolicies((prev) => ({
              ...prev,
              defaultItemLocation: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Default postal code</Label>
        <Input
          value={policies.defaultPostalCode}
          onChange={(e) =>
            setPolicies((prev) => ({
              ...prev,
              defaultPostalCode: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Default handling time</Label>
        <Input
          type="number"
          min={0}
          value={policies.defaultHandlingTime}
          onChange={(e) =>
            setPolicies((prev) => ({
              ...prev,
              defaultHandlingTime: Number(e.target.value),
            }))
          }
        />
      </div>
      <p className="text-xs text-zinc-500">
        Policy IDs are written to CSV only when the active official template
        already contains those headers.
      </p>
      <Button
        onClick={save}
        disabled={saving}
        title={saving ? "Saving policies…" : "Save eBay business policy IDs"}
      >
        {saving ? "Saving…" : "Save policies"}
      </Button>
    </div>
  );
}

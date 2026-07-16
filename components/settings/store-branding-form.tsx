"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { STORE_BRANDING_DEFAULTS, type StoreBranding } from "@/config/store-branding";

export function StoreBrandingForm() {
  const [branding, setBranding] = useState<StoreBranding>({
    ...STORE_BRANDING_DEFAULTS,
    colors: { ...STORE_BRANDING_DEFAULTS.colors },
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/settings/branding");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || "Failed to load branding");
        }
        const data = (await res.json()) as { branding: StoreBranding };
        setBranding(data.branding);
      } catch (error) {
        toast.message("Using Higlou Store defaults", {
          description:
            error instanceof Error ? error.message : "Could not load branding",
        });
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/branding", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(branding),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Save failed");
      }
      const data = (await res.json()) as { branding: StoreBranding };
      setBranding(data.branding);
      toast.success("Store branding saved");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading branding…</p>;
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Store name</Label>
        <Input
          value={branding.storeName}
          onChange={(e) =>
            setBranding((prev) => ({ ...prev, storeName: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Display name</Label>
        <Input
          value={branding.storeNameDisplay}
          onChange={(e) =>
            setBranding((prev) => ({
              ...prev,
              storeNameDisplay: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Slogan</Label>
        <Input
          value={branding.slogan}
          onChange={(e) =>
            setBranding((prev) => ({ ...prev, slogan: e.target.value }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Thank you message</Label>
        <Input
          value={branding.thankYouMessage}
          onChange={(e) =>
            setBranding((prev) => ({
              ...prev,
              thankYouMessage: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Shipping information</Label>
        <Textarea
          value={branding.shippingInformation}
          onChange={(e) =>
            setBranding((prev) => ({
              ...prev,
              shippingInformation: e.target.value,
            }))
          }
        />
      </div>
      <div className="space-y-2">
        <Label>Return policy text</Label>
        <p className="text-sm text-muted-foreground">
          Listing descriptions do not include a Returns section (Higlou Store
          currently has no return policy advertising). This field is kept for
          future use only and is not rendered in eBay HTML.
        </p>
        <Textarea
          value={branding.returnPolicyText}
          onChange={(e) =>
            setBranding((prev) => ({
              ...prev,
              returnPolicyText: e.target.value,
            }))
          }
          placeholder="Leave empty — not shown in descriptions"
        />
      </div>
      <div className="space-y-2">
        <Label>Accent color</Label>
        <Input
          value={branding.colors.accent}
          onChange={(e) =>
            setBranding((prev) => ({
              ...prev,
              colors: { ...prev.colors, accent: e.target.value },
            }))
          }
        />
      </div>
      <Button
        onClick={save}
        disabled={saving}
        title={saving ? "Saving branding…" : "Save Higlou Store branding"}
      >
        {saving ? "Saving…" : "Save branding"}
      </Button>
    </div>
  );
}

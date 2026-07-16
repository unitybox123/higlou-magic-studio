"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

type ActiveTemplate = {
  source: string;
  sha256: string;
  templateType: string;
  fileName: string;
  id?: string | null;
};

export function EbayTemplateForm() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [active, setActive] = useState<ActiveTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch("/api/templates");
        if (!res.ok) {
          const body = (await res.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || "Failed to load templates");
        }
        const data = (await res.json()) as { active: ActiveTemplate };
        if (!cancelled) setActive(data.active);
      } catch (error) {
        if (!cancelled) {
          toast.message("Using seed template fallback", {
            description:
              error instanceof Error
                ? error.message
                : "Could not load templates",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const upload = async (file: File) => {
    setUploading(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/templates", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error || "Template upload failed");
      }
      const data = (await res.json()) as { active: ActiveTemplate };
      setActive(data.active);
      toast.success("Active eBay template updated");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-zinc-500">Loading template…</p>;
  }

  return (
    <div className="space-y-3">
      {active ? (
        <div className="space-y-1 rounded-xl bg-zinc-50 p-3 text-xs text-zinc-600">
          <p>
            <span className="font-medium text-zinc-900">Active source:</span>{" "}
            {active.source}
          </p>
          <p>
            <span className="font-medium text-zinc-900">File:</span>{" "}
            {active.fileName}
          </p>
          <p>
            <span className="font-medium text-zinc-900">Type:</span>{" "}
            {active.templateType}
          </p>
          <p className="break-all">
            <span className="font-medium text-zinc-900">SHA256:</span>{" "}
            {active.sha256}
          </p>
        </div>
      ) : (
        <p className="text-sm text-zinc-500">No active template loaded.</p>
      )}

      <div className="space-y-2">
        <Label>Upload official Seller Hub CSV</Label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="outline"
          disabled={uploading}
          title={
            uploading
              ? "Uploading and validating template…"
              : "Upload replacement official eBay CSV template"
          }
          onClick={() => inputRef.current?.click()}
        >
          {uploading ? "Uploading…" : "Upload template CSV"}
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Must include #INFO and required headers. Uploading deactivates previous
        templates and sets this one active.
      </p>
    </div>
  );
}

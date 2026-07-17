"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { createClient } from "@/lib/supabase/client";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { cn } from "@/lib/utils";

type ProductRow = {
  id: string;
  title: string;
  brand: string;
  status: string;
  updatedAt: string;
  coverUrl?: string | null;
  categoryName?: string | null;
};

type CsvRow = {
  id: string;
  fileName: string;
  createdAt: string;
  productId?: string | null;
};

type CostsSummary = {
  snapshot?: { productsProcessed?: number };
  projection?: { estimatedAiCostToDate?: number };
};

function firstNameFromEmail(email: string | null | undefined) {
  if (!email) return null;
  const local = email.split("@")[0]?.trim();
  if (!local) return null;
  return local.charAt(0).toUpperCase() + local.slice(1);
}

function statusTone(status: string) {
  const normalized = status.toLowerCase();
  if (normalized.includes("csv") || normalized.includes("ready")) {
    return "Ready to export";
  }
  if (normalized.includes("draft")) return "Draft";
  return "Needs review";
}

export default function HomeWorkspacePage() {
  const [name, setName] = useState<string | null>(null);
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [exportsList, setExportsList] = useState<CsvRow[]>([]);
  const [aiCost, setAiCost] = useState<number | null>(null);
  const [listingsCount, setListingsCount] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (cancelled || !user) return;
        const metaName =
          (user.user_metadata?.full_name as string | undefined) ??
          (user.user_metadata?.name as string | undefined) ??
          null;
        setName(metaName?.split(" ")[0] || firstNameFromEmail(user.email));
      } catch {
        /* guest / unconfigured */
      }
    })();

    void (async () => {
      try {
        const res = await fetch("/api/products");
        if (!res.ok) return;
        const body = (await res.json()) as { products: ProductRow[] };
        if (!cancelled) setProducts(body.products ?? []);
      } catch {
        /* degrade gracefully */
      }
    })();

    void (async () => {
      try {
        const res = await fetch("/api/csv-history");
        if (!res.ok) return;
        const body = (await res.json()) as { files: CsvRow[] };
        if (!cancelled) setExportsList(body.files ?? []);
      } catch {
        /* degrade gracefully */
      }
    })();

    void (async () => {
      try {
        const res = await fetch("/api/costs");
        if (!res.ok) return;
        const body = (await res.json()) as CostsSummary;
        if (cancelled) return;
        setListingsCount(body.snapshot?.productsProcessed ?? null);
        setAiCost(body.projection?.estimatedAiCostToDate ?? null);
      } catch {
        /* degrade gracefully */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const drafts = useMemo(
    () =>
      products
        .filter((p) => {
          const s = (p.status || "").toLowerCase();
          return !s.includes("csv generated") && !s.includes("exported");
        })
        .slice(0, 6),
    [products],
  );

  const avgConfidence = useMemo(() => {
    const reviewed = products.filter((p) =>
      Boolean(p.title?.trim() && p.brand?.trim()),
    ).length;
    if (!products.length) return null;
    return Math.round((reviewed / products.length) * 100);
  }, [products]);

  const monthListings = listingsCount ?? products.length;
  const draftsReady = drafts.length;
  const greeting = name ? `Welcome back, ${name}` : "Welcome back";

  return (
    <AppShell hideHeader>
      <div className="mx-auto max-w-3xl">
        <section className="relative overflow-hidden pb-12 pt-4">
          <div
            aria-hidden
            className="pointer-events-none absolute -left-24 -top-16 size-72 rounded-full bg-[radial-gradient(circle_at_center,rgba(244,201,40,0.12),transparent_70%)]"
          />
          <p className="text-[11px] font-semibold tracking-[0.22em] text-zinc-400">
            HIGLOU STUDIO
          </p>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight text-zinc-950 sm:text-4xl">
            {greeting}
          </h1>
          <p className="mt-3 max-w-lg text-base text-zinc-500">
            Upload photos, I analyze the product, then you export a perfect CSV
            for eBay and publish the same listing to your marketplace.
          </p>
          <Link
            href="/listings/new"
            className="mt-8 inline-flex h-12 items-center gap-2 rounded-xl bg-zinc-950 px-6 text-sm font-medium text-white transition hover:bg-zinc-800"
          >
            <Sparkles className="size-4" />
            New Listing
          </Link>
        </section>

        <section className="border-t border-zinc-200/80 py-8">
          <p className="text-xs font-medium uppercase tracking-wide text-zinc-400">
            This month
          </p>
          <div className="mt-4 flex flex-wrap gap-x-8 gap-y-3 text-sm text-zinc-600">
            <span>
              <strong className="font-semibold text-zinc-950">
                {monthListings}
              </strong>{" "}
              Listings
            </span>
            <span>
              <strong className="font-semibold text-zinc-950">
                {avgConfidence != null ? `${avgConfidence}%` : "—"}
              </strong>{" "}
              AI Confidence
            </span>
            <span>
              <strong className="font-semibold text-zinc-950">
                {aiCost != null ? `$${aiCost.toFixed(2)}` : "—"}
              </strong>{" "}
              AI Cost
            </span>
            <span>
              Drafts Ready:{" "}
              <strong className="font-semibold text-zinc-950">
                {draftsReady}
              </strong>
            </span>
          </div>
        </section>

        <section className="space-y-4 border-t border-zinc-200/80 py-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
              Continue working
            </h2>
            <Link
              href="/listings"
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              All listings
            </Link>
          </div>
          {drafts.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No drafts yet — drop photos and I&apos;ll start a listing for you.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {drafts.map((draft) => (
                <Link
                  key={draft.id}
                  href={`/listings/${draft.id}`}
                  className="group flex gap-3 rounded-2xl bg-white p-3 transition hover:bg-zinc-50"
                >
                  <div className="size-16 shrink-0 overflow-hidden rounded-xl bg-zinc-100">
                    {draft.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.coverUrl}
                        alt=""
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-[10px] text-zinc-400">
                        No photo
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1 py-0.5">
                    <p className="truncate text-sm font-medium text-zinc-950">
                      {draft.title || "Untitled listing"}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-zinc-500">
                      {draft.brand || "Brand TBD"} ·{" "}
                      {statusTone(draft.status)}
                    </p>
                    <p className="mt-1 text-[11px] text-zinc-400">
                      Edited {formatRelativeTime(draft.updatedAt)}
                    </p>
                  </div>
                  <ArrowRight className="mt-1 size-4 shrink-0 text-zinc-300 transition group-hover:text-zinc-600" />
                </Link>
              ))}
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-zinc-200/80 py-8">
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950">
              Recent exports
            </h2>
            <Link
              href="/exports"
              className="text-sm text-zinc-500 hover:text-zinc-900"
            >
              View all
            </Link>
          </div>
          {exportsList.length === 0 ? (
            <p className="text-sm text-zinc-500">
              When you export a CSV, I&apos;ll keep it here.
            </p>
          ) : (
            <ul className="space-y-2">
              {exportsList.slice(0, 5).map((row) => (
                <li key={row.id}>
                  <a
                    href={`/api/csv-history/${row.id}/download`}
                    className={cn(
                      "flex items-center justify-between gap-3 rounded-xl px-1 py-2.5 text-sm transition hover:bg-white",
                    )}
                  >
                    <span className="truncate font-medium text-zinc-800">
                      {row.fileName}
                    </span>
                    <span className="shrink-0 text-xs text-zinc-400">
                      CSV exported {formatRelativeTime(row.createdAt)}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </AppShell>
  );
}

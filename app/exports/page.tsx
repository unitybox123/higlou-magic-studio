"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { formatRelativeTime } from "@/lib/format-relative-time";

type CsvRow = {
  id: string;
  fileName: string;
  createdAt: string;
  productId?: string | null;
};

export default function ExportsPage() {
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch("/api/csv-history");
        if (response.status === 401 || response.status === 503) {
          if (!cancelled) {
            setError("Sign in to view your exports.");
            setRows([]);
          }
          return;
        }
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(body?.error || "Failed to load exports");
        }
        const body = (await response.json()) as { files: CsvRow[] };
        if (!cancelled) setRows(body.files ?? []);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load exports");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AppShell
      title="Exports"
      description="CSV files ready for eBay File Exchange — download anytime."
    >
      {loading ? (
        <p className="text-sm text-zinc-500">Loading exports…</p>
      ) : error ? (
        <p className="max-w-md text-sm text-zinc-600">{error}</p>
      ) : rows.length === 0 ? (
        <div className="max-w-md py-6">
          <p className="text-base font-medium text-zinc-950">No exports yet</p>
          <p className="mt-2 text-sm text-zinc-500">
            When a listing is ready, export a CSV and I&apos;ll keep it here for
            you.
          </p>
          <Link
            href="/listings/new"
            className="mt-6 inline-flex h-10 items-center rounded-xl bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          >
            New Listing
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-100 overflow-hidden rounded-2xl bg-white">
          {rows.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate font-medium text-zinc-950">
                  {row.fileName}
                </p>
                <p className="mt-1 text-sm text-zinc-500">
                  CSV exported {formatRelativeTime(row.createdAt)}
                </p>
              </div>
              <div className="flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    window.location.href = `/api/csv-history/${row.id}/download`;
                  }}
                  className="inline-flex h-9 items-center rounded-xl bg-zinc-950 px-3.5 text-sm font-medium text-white hover:bg-zinc-800"
                >
                  Download
                </button>
                {row.productId ? (
                  <Link
                    href={`/listings/${row.productId}`}
                    className="inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-medium text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950"
                  >
                    Open listing
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}

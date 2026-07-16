"use client";

import { ChevronDown } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CONDITION_OPTIONS } from "@/config/condition-map";
import { EBAY_CATEGORY_OPTIONS } from "@/config/ebay-categories";
import {
  TITLE_HELPER_ACTIONS,
  isCategoryPerfectMatch,
  type AttentionField,
  type ReviewFieldId,
} from "@/components/listing/review-helpers";
import type { ProductListing } from "@/types/product";
import { cn } from "@/lib/utils";

function ReviewCardShell({
  id,
  title,
  badge,
  needsAttention,
  children,
}: {
  id: string;
  title: string;
  badge?: React.ReactNode;
  needsAttention?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className={cn(
        "scroll-mt-28 rounded-2xl border bg-white p-5 transition-shadow duration-300",
        needsAttention
          ? "border-[#f4c928]/80 shadow-[0_0_0_1px_rgba(244,201,40,0.25)]"
          : "border-zinc-200/90",
      )}
    >
      <div className="mb-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold tracking-wide text-zinc-500">
          {title}
        </h3>
        {badge}
      </div>
      {children}
    </div>
  );
}

export function ReviewCards({
  listing,
  attentionFields,
  analyzing,
  onUpdate,
  onCategoryChange,
  onConditionChange,
  onImproveTitle,
  firstAttentionRef,
}: {
  listing: ProductListing;
  attentionFields: AttentionField[];
  analyzing?: boolean;
  onUpdate: <K extends keyof ProductListing>(
    key: K,
    value: ProductListing[K],
  ) => void;
  onCategoryChange: (categoryId: string) => void;
  onConditionChange: (condition: string) => void;
  onImproveTitle: (instruction: string) => void;
  firstAttentionRef?: React.RefObject<HTMLDivElement | null>;
}) {
  const attentionIds = new Set(attentionFields.map((f) => f.id));
  const reason = (id: ReviewFieldId) =>
    attentionFields.find((f) => f.id === id)?.reason;
  const perfectCategory = isCategoryPerfectMatch(listing);
  const firstId = attentionFields[0]?.id;

  return (
    <section className="space-y-3 animate-in fade-in duration-500">
      <div className="flex justify-end">
        <p className="text-xs text-zinc-500">
          {attentionFields.length > 0
            ? `${attentionFields.length} need attention`
            : "Looking good"}
        </p>
      </div>

      <div
        ref={firstId === "title" ? firstAttentionRef : undefined}
        className={firstId === "title" ? "rounded-2xl ring-offset-2" : undefined}
      >
        <ReviewCardShell
          id="review-title"
          title="TITLE"
          needsAttention={attentionIds.has("title")}
          badge={
            <span className="text-xs text-zinc-400">
              {listing.title.length}/80
            </span>
          }
        >
          <Input
            value={listing.title}
            maxLength={80}
            onChange={(e) => onUpdate("title", e.target.value)}
            className="rounded-xl border-zinc-200"
            placeholder="Product title"
          />
          {reason("title") ? (
            <p className="mt-2 text-xs text-amber-700">{reason("title")}</p>
          ) : null}
          <div className="mt-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                disabled={analyzing}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-800 outline-none hover:bg-zinc-50 disabled:opacity-50"
              >
                Improve
                <ChevronDown className="size-3.5 opacity-60" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="min-w-40">
                {TITLE_HELPER_ACTIONS.map((action) => (
                  <DropdownMenuItem
                    key={action.label}
                    onClick={() => onImproveTitle(action.instruction)}
                  >
                    {action.label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </ReviewCardShell>
      </div>

      <div ref={firstId === "price" ? firstAttentionRef : undefined}>
        <ReviewCardShell
          id="review-price"
          title="PRICE"
          needsAttention={attentionIds.has("price")}
        >
          <div className="relative">
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-zinc-400">
              $
            </span>
            <Input
              type="number"
              min={0}
              step="0.01"
              value={listing.price ?? ""}
              onChange={(e) =>
                onUpdate(
                  "price",
                  e.target.value === "" ? null : Number(e.target.value),
                )
              }
              className="rounded-xl border-zinc-200 pl-7"
              placeholder="0.00"
            />
          </div>
          {reason("price") ? (
            <p className="mt-2 text-xs text-amber-700">{reason("price")}</p>
          ) : null}
        </ReviewCardShell>
      </div>

      <div ref={firstId === "category" ? firstAttentionRef : undefined}>
        <ReviewCardShell
          id="review-category"
          title="CATEGORY"
          needsAttention={attentionIds.has("category")}
          badge={
            perfectCategory ? (
              <span className="rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                Perfect Match
              </span>
            ) : (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                Needs review
              </span>
            )
          }
        >
          <Select
            value={listing.categoryId || undefined}
            onValueChange={(value) => {
              if (!value) return;
              onCategoryChange(value);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue placeholder="Choose eBay category" />
            </SelectTrigger>
            <SelectContent>
              {EBAY_CATEGORY_OPTIONS.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.name} ({option.id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-xs text-zinc-500">
            {listing.categoryName || "No category name yet"}
            {listing.categoryId ? ` · ID ${listing.categoryId}` : ""}
          </p>
        </ReviewCardShell>
      </div>

      <div ref={firstId === "condition" ? firstAttentionRef : undefined}>
        <ReviewCardShell
          id="review-condition"
          title="CONDITION"
          needsAttention={attentionIds.has("condition")}
        >
          <Select
            value={listing.condition}
            onValueChange={(value) => {
              if (!value) return;
              onConditionChange(value);
            }}
          >
            <SelectTrigger className="rounded-xl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CONDITION_OPTIONS.map((option) => (
                <SelectItem key={option.label} value={option.label}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </ReviewCardShell>
      </div>

      <div ref={firstId === "quantity" ? firstAttentionRef : undefined}>
        <ReviewCardShell
          id="review-quantity"
          title="QUANTITY"
          needsAttention={attentionIds.has("quantity")}
        >
          <Input
            type="number"
            min={1}
            step={1}
            value={listing.quantity}
            onChange={(e) => onUpdate("quantity", Number(e.target.value))}
            className="rounded-xl border-zinc-200"
          />
          <div className="mt-3 space-y-1.5">
            <Label className="text-xs text-zinc-500">Listing format</Label>
            <Select
              value={listing.listingFormat}
              onValueChange={(value) => {
                if (!value) return;
                onUpdate(
                  "listingFormat",
                  value as ProductListing["listingFormat"],
                );
              }}
            >
              <SelectTrigger className="rounded-xl">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="FixedPrice">FixedPrice</SelectItem>
                <SelectItem value="Auction">Auction</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </ReviewCardShell>
      </div>
    </section>
  );
}

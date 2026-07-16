"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AdvancedDrawer } from "@/components/listing/advanced-drawer";
import type { ConfidenceStatus } from "@/lib/ai/confidence-engine";
import type { ProductListing } from "@/types/product";

type FieldConfidence = Record<
  string,
  { status: ConfidenceStatus; sources: string[]; confidence: number }
>;

export function MoreDetailsDialog({
  open,
  onOpenChange,
  listing,
  fieldConfidence,
  analyzing,
  loadingProduct,
  httpsImageUrls,
  onUpdate,
  onRegenerateDescription,
  setFieldConfidence,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  listing: ProductListing;
  fieldConfidence: FieldConfidence;
  analyzing: boolean;
  loadingProduct: boolean;
  httpsImageUrls: string[];
  onUpdate: <K extends keyof ProductListing>(
    key: K,
    value: ProductListing[K],
  ) => void;
  onRegenerateDescription: () => void;
  setFieldConfidence: React.Dispatch<React.SetStateAction<FieldConfidence>>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(90vh,820px)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>More details</DialogTitle>
          <DialogDescription>
            Brand, description, shipping, and policies — optional polish.
          </DialogDescription>
        </DialogHeader>
        <AdvancedDrawer
          listing={listing}
          fieldConfidence={fieldConfidence}
          analyzing={analyzing}
          loadingProduct={loadingProduct}
          httpsImageUrls={httpsImageUrls}
          onUpdate={onUpdate}
          onRegenerateDescription={onRegenerateDescription}
          setFieldConfidence={setFieldConfidence}
          forceOpen
        />
      </DialogContent>
    </Dialog>
  );
}

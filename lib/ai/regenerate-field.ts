import { z } from "zod";
import { createOpenAIClient, getOpenAIModel } from "@/lib/ai/openai-client";
import { calculateOpenAICost } from "@/lib/costs/calculate-openai-cost";
import { getOpenAIPricingForTier } from "@/lib/costs/pricing";
import { recordAiUsageEvent } from "@/lib/ai/usage";
import type { SupabaseClient } from "@supabase/supabase-js";
import { STORE_BRANDING_DEFAULTS } from "@/config/store-branding";

export const partialRegenSchema = z.object({
  field: z.enum(["title", "description"]),
  listingSnapshot: z.object({
    title: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
    categoryName: z.string().optional(),
    condition: z.string().optional(),
    size: z.string().optional(),
    upc: z.string().optional(),
    descriptionSummary: z.string().optional(),
    colors: z.array(z.string()).optional(),
    materials: z.array(z.string()).optional(),
    features: z.array(z.string()).optional(),
  }),
  productId: z.string().uuid().optional(),
  instruction: z.string().max(500).optional(),
});

/**
 * Partial field regeneration: text-only OpenAI call.
 * Does not re-send product images or re-run Vision/ZXing.
 */
export async function regenerateListingField(options: {
  field: "title" | "description";
  listingSnapshot: z.infer<typeof partialRegenSchema>["listingSnapshot"];
  instruction?: string;
  userId?: string;
  productId?: string;
  supabase?: SupabaseClient | null;
}) {
  const openai = createOpenAIClient();
  const model = getOpenAIModel("economy");
  const snap = options.listingSnapshot;

  const prompt =
    options.field === "title"
      ? `Improve only the eBay title for Higlou Store. Max 80 characters. Return JSON {"title":"..."}.
Current title: ${snap.title || ""}
Known facts: ${JSON.stringify(snap)}
Instruction: ${options.instruction || "Make the title clearer and more searchable without inventing product facts."}`
      : `Regenerate only the product description summary for Higlou Store HTML body.
Return JSON {"descriptionSummary":"..."}.
Do not invent brand/model/UPC. Reuse known facts: ${JSON.stringify(snap)}
Instruction: ${options.instruction || "Write a clear seller-friendly description."}
Always keep seller brand as ${STORE_BRANDING_DEFAULTS.storeName}.`;

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You edit a single eBay listing field. Never re-analyze images. Never invent identifiers.",
      },
      { role: "user", content: prompt },
    ],
  });

  const usageCost = calculateOpenAICost(
    completion.usage,
    getOpenAIPricingForTier("economy"),
  );

  await recordAiUsageEvent(options.supabase ?? null, {
    userId: options.userId,
    productId: options.productId,
    provider: "openai",
    model,
    operation: `regen_${options.field}`,
    requestId: completion.id,
    inputTokens: usageCost.inputTokens,
    cachedInputTokens: usageCost.cachedInputTokens,
    outputTokens: usageCost.outputTokens,
    imageCount: 0,
    estimatedCost: usageCost.estimatedCost,
    status: "ok",
  });

  const content = completion.choices[0]?.message?.content;
  if (!content) throw new Error("Empty regeneration response");
  const parsed = JSON.parse(content) as {
    title?: string;
    descriptionSummary?: string;
  };

  return {
    field: options.field,
    title: parsed.title,
    descriptionSummary: parsed.descriptionSummary,
    costEstimate: {
      estimatedCost: usageCost.estimatedCost,
      model,
      disclaimer:
        "Estimated platform operating cost only. Not an official invoice.",
    },
  };
}

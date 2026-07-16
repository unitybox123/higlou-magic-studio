import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import { DEFAULT_VALUES } from "@/config/default-values";

const policiesSchema = z.object({
  paymentPolicyId: z.string().optional().default(""),
  returnPolicyId: z.string().optional().default(""),
  shippingPolicyId: z.string().optional().default(""),
  defaultItemLocation: z.string().optional().default(DEFAULT_VALUES.itemLocation),
  defaultPostalCode: z.string().optional().default(""),
  defaultHandlingTime: z
    .number()
    .int()
    .min(0)
    .optional()
    .default(DEFAULT_VALUES.handlingTime),
});

function mapPolicies(row: Record<string, unknown> | null | undefined) {
  return {
    paymentPolicyId: String(row?.payment_policy_id ?? ""),
    returnPolicyId: String(row?.return_policy_id ?? ""),
    shippingPolicyId: String(row?.shipping_policy_id ?? ""),
    defaultItemLocation: String(
      row?.default_item_location ?? DEFAULT_VALUES.itemLocation,
    ),
    defaultPostalCode: String(row?.default_postal_code ?? ""),
    defaultHandlingTime: Number(
      row?.default_handling_time ?? DEFAULT_VALUES.handlingTime,
    ),
  };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("ebay_policy_settings")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ policies: mapPolicies(data as Record<string, unknown> | null) });
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const json = await request.json();
    const data = policiesSchema.parse(json);

    const payload = {
      user_id: auth.user.id,
      payment_policy_id: data.paymentPolicyId,
      return_policy_id: data.returnPolicyId,
      shipping_policy_id: data.shippingPolicyId,
      default_item_location: data.defaultItemLocation,
      default_postal_code: data.defaultPostalCode,
      default_handling_time: data.defaultHandlingTime,
      updated_at: new Date().toISOString(),
    };

    const { data: saved, error } = await auth.supabase
      .from("ebay_policy_settings")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      policies: mapPolicies(saved as Record<string, unknown>),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save policies";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

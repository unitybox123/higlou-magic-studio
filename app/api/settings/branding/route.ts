import { NextResponse } from "next/server";
import { z } from "zod";
import { requireUser } from "@/lib/auth/require-user";
import {
  STORE_BRANDING_DEFAULTS,
  type StoreBranding,
} from "@/config/store-branding";

const brandingSchema = z.object({
  storeName: z.string().optional(),
  storeNameDisplay: z.string().optional(),
  slogan: z.string().optional(),
  thankYouMessage: z.string().optional(),
  thankYouSubtext: z.string().optional(),
  shippingInformation: z.string().optional(),
  returnPolicyText: z.string().optional(),
  warrantyInformation: z.string().optional(),
  footerText: z.string().optional(),
  logoUrl: z.string().optional(),
  colors: z
    .object({
      headerBackground: z.string().optional(),
      headerText: z.string().optional(),
      bodyText: z.string().optional(),
      accent: z.string().optional(),
      panelBackground: z.string().optional(),
      border: z.string().optional(),
    })
    .optional(),
});

function mergeBranding(
  row: Record<string, unknown> | null | undefined,
): StoreBranding {
  const colors = {
    ...STORE_BRANDING_DEFAULTS.colors,
    ...((row?.colors as Record<string, string> | undefined) ?? {}),
  };

  return {
    storeName:
      String(row?.store_name ?? STORE_BRANDING_DEFAULTS.storeName) ||
      STORE_BRANDING_DEFAULTS.storeName,
    storeNameDisplay:
      String(row?.store_name_display ?? STORE_BRANDING_DEFAULTS.storeNameDisplay) ||
      STORE_BRANDING_DEFAULTS.storeNameDisplay,
    slogan:
      String(row?.slogan ?? STORE_BRANDING_DEFAULTS.slogan) ||
      STORE_BRANDING_DEFAULTS.slogan,
    thankYouMessage:
      String(
        row?.thank_you_message ?? STORE_BRANDING_DEFAULTS.thankYouMessage,
      ) || STORE_BRANDING_DEFAULTS.thankYouMessage,
    thankYouSubtext: String(
      row?.thank_you_subtext ?? STORE_BRANDING_DEFAULTS.thankYouSubtext,
    ),
    shippingInformation: String(
      row?.shipping_information ?? STORE_BRANDING_DEFAULTS.shippingInformation,
    ),
    returnPolicyText: String(
      row?.return_policy_text ?? STORE_BRANDING_DEFAULTS.returnPolicyText,
    ),
    warrantyInformation: String(
      row?.warranty_information ?? STORE_BRANDING_DEFAULTS.warrantyInformation,
    ),
    footerText: String(
      row?.footer_text ?? STORE_BRANDING_DEFAULTS.footerText,
    ),
    logoUrl: String(row?.logo_url ?? STORE_BRANDING_DEFAULTS.logoUrl),
    colors: {
      headerBackground:
        colors.headerBackground ||
        STORE_BRANDING_DEFAULTS.colors.headerBackground,
      headerText:
        colors.headerText || STORE_BRANDING_DEFAULTS.colors.headerText,
      bodyText: colors.bodyText || STORE_BRANDING_DEFAULTS.colors.bodyText,
      accent: colors.accent || STORE_BRANDING_DEFAULTS.colors.accent,
      panelBackground:
        colors.panelBackground ||
        STORE_BRANDING_DEFAULTS.colors.panelBackground,
      border: colors.border || STORE_BRANDING_DEFAULTS.colors.border,
    },
  };
}

export async function GET() {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  const { data, error } = await auth.supabase
    .from("store_branding")
    .select("*")
    .eq("user_id", auth.user.id)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    branding: mergeBranding(data as Record<string, unknown> | null),
  });
}

export async function PUT(request: Request) {
  const auth = await requireUser();
  if (!auth.ok) return auth.response;

  try {
    const json = await request.json();
    const patch = brandingSchema.parse(json);
    const current = mergeBranding(null);
    const next: StoreBranding = {
      storeName: patch.storeName ?? current.storeName,
      storeNameDisplay: patch.storeNameDisplay ?? current.storeNameDisplay,
      slogan: patch.slogan ?? current.slogan,
      thankYouMessage: patch.thankYouMessage ?? current.thankYouMessage,
      thankYouSubtext: patch.thankYouSubtext ?? current.thankYouSubtext,
      shippingInformation:
        patch.shippingInformation ?? current.shippingInformation,
      returnPolicyText: patch.returnPolicyText ?? current.returnPolicyText,
      warrantyInformation:
        patch.warrantyInformation ?? current.warrantyInformation,
      footerText: patch.footerText ?? current.footerText,
      logoUrl: patch.logoUrl ?? current.logoUrl,
      colors: {
        ...current.colors,
        ...(patch.colors ?? {}),
      },
    };

    // Higlou Store branding must never be empty.
    if (!next.storeName.trim()) next.storeName = STORE_BRANDING_DEFAULTS.storeName;
    if (!next.storeNameDisplay.trim()) {
      next.storeNameDisplay = STORE_BRANDING_DEFAULTS.storeNameDisplay;
    }

    const payload = {
      user_id: auth.user.id,
      store_name: next.storeName,
      store_name_display: next.storeNameDisplay,
      slogan: next.slogan,
      thank_you_message: next.thankYouMessage,
      thank_you_subtext: next.thankYouSubtext,
      shipping_information: next.shippingInformation,
      return_policy_text: next.returnPolicyText,
      warranty_information: next.warrantyInformation,
      footer_text: next.footerText,
      logo_url: next.logoUrl,
      colors: next.colors,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await auth.supabase
      .from("store_branding")
      .upsert(payload, { onConflict: "user_id" })
      .select("*")
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      branding: mergeBranding(data as Record<string, unknown>),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to save branding";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

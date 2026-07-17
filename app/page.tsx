import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Higlou — From photos to perfect listing CSVs",
  description:
    "Analyze products with AI, then export a polished CSV for eBay and your marketplace.",
};

export default function MarketingHomePage() {
  return <LandingPage />;
}

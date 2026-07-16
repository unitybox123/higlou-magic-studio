import type { Metadata } from "next";
import { LandingPage } from "@/components/landing/landing-page";

export const metadata: Metadata = {
  title: "Higlou — From photos to professional listings",
  description:
    "Your AI listing team for eBay. Upload photos, get a polished draft in under a minute.",
};

export default function MarketingHomePage() {
  return <LandingPage />;
}

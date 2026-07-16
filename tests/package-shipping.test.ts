import { describe, expect, it } from "vitest";
import {
  estimatePackageAndShipping,
  packageEstimateToCsvValues,
} from "@/lib/ebay/package-shipping";
import { isCategoryProductMismatch } from "@/lib/ebay/category-guard";
import { DEFAULT_VALUES } from "@/config/default-values";

describe("estimatePackageAndShipping", () => {
  it("uses fluid ounces for bottled water weight", () => {
    const estimate = estimatePackageAndShipping({
      title: "Aquafina Purified Water Bottle 16.9 fl oz",
      productType: "Purified Water",
      size: "16.9 fl oz",
      brand: "Aquafina",
    });
    expect(estimate.totalOz).toBeGreaterThanOrEqual(18);
    expect(estimate.totalOz).toBeLessThanOrEqual(24);
    expect(estimate.shippingService).toBe("USPSGroundAdvantage");
    expect(estimate.weightLbs + estimate.weightOz / 16).toBeGreaterThan(1);
  });

  it("matches Seller Hub-ish vacuum box estimates", () => {
    const estimate = estimatePackageAndShipping({
      title: "Shark Robot Vacuum",
      productType: "Robot Vacuum",
      categoryName: "Vacuum Cleaners",
      brand: "Shark",
    });
    expect(estimate.weightLbs).toBe(12);
    expect(estimate.weightOz).toBe(0);
    expect(estimate.lengthIn).toBe(21);
    expect(estimate.widthIn).toBe(16);
    expect(estimate.depthIn).toBe(5);
    expect(estimate.shippingService).toBe("USPSGroundAdvantage");
  });

  it("emits File Exchange / Seller Hub aliases", () => {
    const estimate = estimatePackageAndShipping({
      title: "Aquafina Purified Water",
      size: "16.9 fl oz",
    });
    const values = packageEstimateToCsvValues(estimate);
    expect(values.WeightMajor).toBe(String(estimate.weightLbs));
    expect(values.WeightMinor).toBe(String(estimate.weightOz));
    expect(values.WeightUnit).toBe("lbs");
    expect(values["Shipping service 1 option"]).toBe("USPSGroundAdvantage");
    expect(values["Shipping service 1 priority"]).toBe("1");
    expect(values.PackageType).toBeTruthy();
  });
});

describe("category guard + warehouse defaults", () => {
  it("flags fishing for aquafina", () => {
    expect(
      isCategoryProductMismatch({
        categoryId: "179985",
        categoryName: "Fishing Equipment",
        title: "Aquafina Purified Water Bottle 16.9 fl oz",
        brand: "Aquafina",
        productType: "Purified Water",
      }),
    ).toBe(true);
  });

  it("defaults warehouse to Logansport IN 46947", () => {
    expect(DEFAULT_VALUES.itemLocation).toBe("Logansport, IN");
    expect(DEFAULT_VALUES.postalCode).toBe("46947");
  });
});

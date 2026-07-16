export type PublicMarketplaceListing = {
  id: string;
  slug: string;
  productId: string;
  title: string;
  subtitle: string;
  brand: string;
  sku: string;
  categorySlug: string;
  categoryName: string;
  condition: string;
  price: number;
  currency: string;
  quantity: number;
  descriptionSummary: string;
  descriptionHtml: string;
  itemSpecifics: unknown;
  features: string[];
  colors: string[];
  materials: string[];
  size: string;
  productType: string;
  primaryImageUrl: string;
  imageUrls: string[];
  freeShipping: boolean;
  shippingCost: number | null;
  itemLocation: string;
  postalCode: string;
  publishedAt: string;
};

export type MarketplaceCategory = {
  slug: string;
  name: string;
  icon: string;
};

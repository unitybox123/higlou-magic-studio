/**
 * Single source of truth for product-photo formats across upload, storage,
 * compression, quality gate, and analysis normalization.
 */
export const SUPPORTED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export type SupportedImageMimeType =
  (typeof SUPPORTED_IMAGE_MIME_TYPES)[number];

/** Browsers sometimes claim `image/jpg` — accept as JPEG alias. */
export const ACCEPTED_UPLOAD_MIME_ALIASES = ["image/jpg"] as const;

export const ACCEPTED_UPLOAD_MIME_TYPES = [
  ...SUPPORTED_IMAGE_MIME_TYPES,
  ...ACCEPTED_UPLOAD_MIME_ALIASES,
] as const;

export type AcceptedUploadMimeType =
  (typeof ACCEPTED_UPLOAD_MIME_TYPES)[number];

/** Internal formats after analysis normalization. */
export const NORMALIZED_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
] as const;

export type NormalizedImageMimeType =
  (typeof NORMALIZED_IMAGE_MIME_TYPES)[number];

export const SUPPORTED_IMAGE_ACCEPT_ATTR = SUPPORTED_IMAGE_MIME_TYPES.join(",");

const ACCEPTED_SET = new Set<string>(ACCEPTED_UPLOAD_MIME_TYPES);

export function isAcceptedUploadMime(
  mime: string | null | undefined,
): mime is AcceptedUploadMimeType {
  if (!mime) return false;
  return ACCEPTED_SET.has(mime.toLowerCase());
}

export function isSupportedImageMime(
  mime: string | null | undefined,
): mime is SupportedImageMimeType {
  if (!mime) return false;
  const normalized = mime.toLowerCase() === "image/jpg" ? "image/jpeg" : mime.toLowerCase();
  return (SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(normalized);
}

export function canonicalizeImageMime(
  mime: string | null | undefined,
): SupportedImageMimeType | null {
  if (!mime) return null;
  const lower = mime.toLowerCase();
  if (lower === "image/jpg") return "image/jpeg";
  if ((SUPPORTED_IMAGE_MIME_TYPES as readonly string[]).includes(lower)) {
    return lower as SupportedImageMimeType;
  }
  return null;
}

export function isPngBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  );
}

export function isJpegBuffer(buffer: Buffer): boolean {
  return buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xd8;
}

/** RIFF....WEBP */
export function isWebpBuffer(buffer: Buffer): boolean {
  return (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  );
}

/** ISO BMFF with HEIC/HEIF brand (ftyp…heic|heif|mif1|msf1) */
export function isHeicBuffer(buffer: Buffer): boolean {
  if (buffer.length < 12) return false;
  if (buffer.toString("ascii", 4, 8) !== "ftyp") return false;
  const brands = buffer.toString("ascii", 8, Math.min(buffer.length, 32)).toLowerCase();
  return /heic|heif|mif1|msf1/.test(brands);
}

/**
 * Detect MIME from magic bytes (real format). Prefer this over file extension /
 * Content-Type claims when they disagree.
 */
export function sniffImageMime(buffer: Buffer): string {
  if (isPngBuffer(buffer)) return "image/png";
  if (isJpegBuffer(buffer)) return "image/jpeg";
  if (isWebpBuffer(buffer)) return "image/webp";
  if (isHeicBuffer(buffer)) {
    const brands = buffer.toString("ascii", 8, Math.min(buffer.length, 32)).toLowerCase();
    if (brands.includes("heif")) return "image/heif";
    return "image/heic";
  }
  return "application/octet-stream";
}

/**
 * Resolve authoritative MIME: magic bytes win when they identify a supported type.
 * Falls back to claimed MIME only when sniff fails.
 */
export function resolveImageMime(
  buffer: Buffer,
  claimedMime?: string | null,
): {
  mime: SupportedImageMimeType | null;
  sniffed: string;
  claimed: string | null;
  source: "magic" | "claimed" | "none";
} {
  const sniffed = sniffImageMime(buffer);
  const fromMagic = canonicalizeImageMime(sniffed);
  if (fromMagic) {
    return {
      mime: fromMagic,
      sniffed,
      claimed: claimedMime ?? null,
      source: "magic",
    };
  }
  const fromClaimed = canonicalizeImageMime(claimedMime);
  if (fromClaimed) {
    return {
      mime: fromClaimed,
      sniffed,
      claimed: claimedMime ?? null,
      source: "claimed",
    };
  }
  return {
    mime: null,
    sniffed,
    claimed: claimedMime ?? null,
    source: "none",
  };
}

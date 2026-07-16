/**
 * Upload path: keep originals for eBay / Creative (no quality loss, preserve alpha).
 * Analysis normalizes separately via `normalizeImageForAnalysis` (Sharp).
 *
 * MIME allow-list lives in `config/supported-image-formats.ts` — do not fork lists here.
 */
export async function compressImageBuffer(buffer: Buffer): Promise<Buffer> {
  return buffer;
}

import jpeg from "jpeg-js";
import { PNG } from "pngjs";

export type DecodedRaster = {
  width: number;
  height: number;
  data: Uint8ClampedArray; // RGBA
};

export async function decodeImageBuffer(
  buffer: Buffer,
  mimeHint?: string,
): Promise<DecodedRaster> {
  const isPng =
    mimeHint?.includes("png") ||
    buffer.slice(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));

  if (isPng) {
    const png = PNG.sync.read(buffer);
    return {
      width: png.width,
      height: png.height,
      data: new Uint8ClampedArray(png.data),
    };
  }

  const decoded = jpeg.decode(buffer, { useTArray: true, formatAsRGBA: true });
  return {
    width: decoded.width,
    height: decoded.height,
    data: new Uint8ClampedArray(decoded.data),
  };
}

export function enhanceContrast(raster: DecodedRaster): DecodedRaster {
  const data = new Uint8ClampedArray(raster.data.length);
  for (let i = 0; i < raster.data.length; i += 4) {
    const r = raster.data[i];
    const g = raster.data[i + 1];
    const b = raster.data[i + 2];
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    const contrasted = gray < 128 ? Math.max(0, gray - 40) : Math.min(255, gray + 40);
    data[i] = contrasted;
    data[i + 1] = contrasted;
    data[i + 2] = contrasted;
    data[i + 3] = 255;
  }
  return { width: raster.width, height: raster.height, data };
}

export function rotateRaster(
  raster: DecodedRaster,
  degrees: 0 | 90 | 180 | 270,
): DecodedRaster {
  if (degrees === 0) return raster;
  const { width, height, data } = raster;
  const outW = degrees === 180 ? width : height;
  const outH = degrees === 180 ? height : width;
  const out = new Uint8ClampedArray(outW * outH * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4;
      let dx = x;
      let dy = y;
      if (degrees === 90) {
        dx = height - 1 - y;
        dy = x;
      } else if (degrees === 180) {
        dx = width - 1 - x;
        dy = height - 1 - y;
      } else if (degrees === 270) {
        dx = y;
        dy = width - 1 - x;
      }
      const dst = (dy * outW + dx) * 4;
      out[dst] = data[src];
      out[dst + 1] = data[src + 1];
      out[dst + 2] = data[src + 2];
      out[dst + 3] = data[src + 3];
    }
  }
  return { width: outW, height: outH, data: out };
}

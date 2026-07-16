/** Validate UPC/EAN check digits and barcode string shape. */

export function onlyDigits(value: string): boolean {
  return /^\d+$/.test(value);
}

/** GS1 mod-10 check digit validation for UPC-A / EAN-8 / EAN-13. */
export function isValidGtinChecksum(code: string): boolean {
  if (!onlyDigits(code)) return false;
  if (![8, 12, 13, 14].includes(code.length)) return false;

  const digits = code.split("").map(Number);
  const check = digits.pop()!;
  let sum = 0;
  // From rightmost data digit: odd positions *3, even *1
  const reversed = [...digits].reverse();
  for (let i = 0; i < reversed.length; i += 1) {
    sum += reversed[i] * (i % 2 === 0 ? 3 : 1);
  }
  const expected = (10 - (sum % 10)) % 10;
  return check === expected;
}

export function expandUpcEToUpcA(code: string): string | null {
  if (!/^\d{8}$/.test(code)) return null;
  const d = code.split("");
  const numberSystem = d[0];
  const check = d[7];
  const mfr = d.slice(1, 6);
  const last = d[6];
  let body = "";
  if ("012".includes(last)) {
    body = `${mfr[0]}${mfr[1]}${last}0000${mfr[2]}${mfr[3]}${mfr[4]}`;
  } else if (last === "3") {
    body = `${mfr[0]}${mfr[1]}${mfr[2]}00000${mfr[3]}${mfr[4]}`;
  } else if (last === "4") {
    body = `${mfr[0]}${mfr[1]}${mfr[2]}${mfr[3]}00000${mfr[4]}`;
  } else {
    body = `${mfr[0]}${mfr[1]}${mfr[2]}${mfr[3]}${mfr[4]}0000${last}`;
  }
  const upcA = `${numberSystem}${body}${check}`;
  return isValidGtinChecksum(upcA) ? upcA : null;
}

export function normalizeBarcodeValue(raw: string): string {
  return raw.replace(/\s+/g, "").trim();
}

export function classifyBarcodeFormat(
  value: string,
):
  | "UPC_A"
  | "UPC_E"
  | "EAN_8"
  | "EAN_13"
  | "CODE_128"
  | "CODE_39"
  | "UNKNOWN" {
  const v = normalizeBarcodeValue(value);
  if (/^\d{12}$/.test(v)) return "UPC_A";
  if (/^\d{8}$/.test(v) && expandUpcEToUpcA(v)) return "UPC_E";
  if (/^\d{8}$/.test(v)) return "EAN_8";
  if (/^\d{13}$/.test(v)) return "EAN_13";
  if (/^[0-9A-Z\-. $/+%]+$/i.test(v) && v.length >= 4) return "CODE_39";
  if (v.length >= 4) return "CODE_128";
  return "UNKNOWN";
}

export function validateBarcode(
  raw: string,
  options?: { requireChecksum?: boolean },
): {
  ok: boolean;
  value: string;
  format: ReturnType<typeof classifyBarcodeFormat>;
  checksumValid: boolean | null;
  reason?: string;
} {
  const value = normalizeBarcodeValue(raw);
  if (!value) {
    return {
      ok: false,
      value: "",
      format: "UNKNOWN",
      checksumValid: null,
      reason: "empty",
    };
  }

  const format = classifyBarcodeFormat(value);
  const requireChecksum = options?.requireChecksum ?? true;

  if (["UPC_A", "EAN_8", "EAN_13"].includes(format)) {
    const checksumValid = isValidGtinChecksum(value);
    if (requireChecksum && !checksumValid) {
      return {
        ok: false,
        value,
        format,
        checksumValid: false,
        reason: "invalid_checksum",
      };
    }
    return { ok: true, value, format, checksumValid };
  }

  if (format === "UPC_E") {
    const expanded = expandUpcEToUpcA(value);
    const checksumValid = Boolean(expanded && isValidGtinChecksum(expanded));
    if (requireChecksum && !checksumValid) {
      return {
        ok: false,
        value,
        format,
        checksumValid: false,
        reason: "invalid_checksum",
      };
    }
    return {
      ok: true,
      value: expanded || value,
      format,
      checksumValid,
    };
  }

  return { ok: true, value, format, checksumValid: null };
}

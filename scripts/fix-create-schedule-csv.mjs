import { readFileSync, writeFileSync } from "fs";

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

function escapeCsvCell(value) {
  const flattened = String(value ?? "")
    .replace(/\r\n/g, " ")
    .replace(/[\r\n]+/g, " ")
    .trim();
  if (/[",]/.test(flattened)) {
    return `"${flattened.replaceAll('"', '""')}"`;
  }
  return flattened;
}

const brokenPath = process.argv[2];
const outPath = process.argv[3];
const seedPath = new URL(
  "../templates/ebay-create-listing-template.csv",
  import.meta.url,
);

const broken = readFileSync(brokenPath, "utf8").replace(/^\uFEFF/, "");
const blines = broken.split(/\r?\n/).filter(Boolean);
const headerIdx = blines.findIndex((l) => l.startsWith("Action("));
const bheaders = splitCsvLine(blines[headerIdx]);
const brow = splitCsvLine(blines[headerIdx + 1]);
const map = Object.fromEntries(bheaders.map((h, i) => [h, brow[i] ?? ""]));

const seed = readFileSync(seedPath, "utf8").replace(/^\uFEFF/, "");
const slines = seed.split(/\r?\n/);
const meta = slines.filter(
  (l) => l.startsWith("#INFO") || l.startsWith('"#INFO'),
);
const headerLine = slines.find((l) => l.startsWith("Action("));
const headers = splitCsvLine(headerLine);
const actionHeader = headers[0];

const values = {
  [actionHeader]: "Add",
  "Custom label (SKU)": map["Custom label (SKU)"] || "CHIC-BEDDING-1",
  "Category ID": map["Category ID"] || "177019",
  Title: map.Title || "",
  UPC: map.UPC || "",
  Price: map.Price || "",
  Quantity: map.Quantity || "1",
  "Item photo URL": map["Item photo URL"] || "",
  "Condition ID": map["Condition ID"] || "NEW",
  Description: map.Description || "",
  Format: "FixedPrice",
  Duration: "GTC",
  PostalCode: map.PostalCode || "46947",
  Country: "US",
  CountryCode: "US",
  DispatchTimeMax: map.DispatchTimeMax || "1",
  ShippingType: "Flat",
  "Shipping service 1 option":
    map["Shipping service 1 option"] || "USPSGroundAdvantage",
  "Shipping service 1 cost": map["Shipping service 1 cost"] || "0.00",
  "Shipping service 1 priority": map["Shipping service 1 priority"] || "1",
  WeightMajor: map.WeightMajor || "6",
  WeightMinor: map.WeightMinor || "0",
  WeightUnit: "lbs",
  PackageType: map.PackageType || "PackageThickEnvelope",
  MeasurementSystem: "ENGLISH",
  PackageLength: map.PackageLength || "20",
  PackageWidth: map.PackageWidth || "16",
  PackageDepth: map.PackageDepth || "10",
  ReturnsAcceptedOption: "ReturnsNotAccepted",
};

const cCols = bheaders.filter((h) => h.startsWith("C:"));
const allHeaders = [...headers, ...cCols.filter((c) => !headers.includes(c))];
const row = allHeaders.map((h) => escapeCsvCell(values[h] ?? map[h] ?? ""));
const outHeader = allHeaders.map(escapeCsvCell).join(",");
const body = `${[...meta, outHeader, row.join(",")].join("\r\n")}\r\n`;
writeFileSync(outPath, `\uFEFF${body}`, "utf8");

console.log("Wrote", outPath);
console.log("Template INFO:", meta[0]);
console.log("Action:", values[actionHeader]);
console.log(
  "Postal/Ship/Weight:",
  values.PostalCode,
  values["Shipping service 1 option"],
  `${values.WeightMajor}lb ${values.WeightMinor}oz`,
);

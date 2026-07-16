import { readFileSync } from "fs";
import {
  generateEbayCsvFromTemplate,
  splitCsvLine,
} from "../lib/csv/ebay-template";
import { buildHiglouDescriptionHtml } from "../lib/ebay/description-html";
import { sanitizeEbayHtml } from "../lib/ebay/sanitize-html";
import { buildItemPhotoUrlValue } from "../lib/ebay/listing-helpers";

const raw = readFileSync("./templates/ebay-draft-listing-template.csv", "utf8");
const description = sanitizeEbayHtml(
  buildHiglouDescriptionHtml({
    productTitle: "T",
    productIntroduction: "I",
    features: ["A"],
    itemCondition: "New",
    packageContents: ["1"],
  }),
);

const csv = generateEbayCsvFromTemplate({
  templateRaw: raw,
  valuesByHeader: {
    "Action(SiteID=US|Country=US|Currency=USD|Version=1193|CC=UTF-8)": "Draft",
    "Custom label (SKU)": "SKU",
    "Category ID": "1",
    Title: "Title",
    UPC: "",
    Price: "49.99",
    Quantity: "1",
    "Item photo URL": buildItemPhotoUrlValue([
      "https://a.com/a.jpg",
      "https://b.com/b.jpg",
    ]),
    "Condition ID": "NEW",
    Description: description,
    Format: "FixedPrice",
  },
  dynamicCColumns: {
    "C:Brand": "Chic Home",
    "C:Size": "Queen",
  },
});

const lines = csv.slice(1).trimEnd().split(/\r?\n/);
console.log({
  lineCount: lines.length,
  headerLen: splitCsvLine(lines[4]).length,
  rowLen: splitCsvLine(lines[5]).length,
  rowStart: lines[5]?.slice(0, 80),
  descriptionLength: description.length,
});

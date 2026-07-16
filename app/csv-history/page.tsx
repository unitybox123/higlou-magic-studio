import { redirect } from "next/navigation";

/** Legacy bookmark — CSV History is now Exports. */
export default function CsvHistoryRedirectPage() {
  redirect("/exports");
}

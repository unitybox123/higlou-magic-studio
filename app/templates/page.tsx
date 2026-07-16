import { redirect } from "next/navigation";

/** Templates live under Settings. */
export default function TemplatesRedirectPage() {
  redirect("/settings#templates");
}

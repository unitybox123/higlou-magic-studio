import { redirect } from "next/navigation";

/** Legacy bookmark — Studio workspace lives at `/home`. */
export default function DashboardPage() {
  redirect("/home");
}

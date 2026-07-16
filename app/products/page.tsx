import { redirect } from "next/navigation";

/** Legacy bookmark — product library lives at `/listings`. */
export default function ProductsRedirectPage() {
  redirect("/listings");
}

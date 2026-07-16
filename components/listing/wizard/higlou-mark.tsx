import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

/** Brand mark + Higlou wordmark (wizard / listing chrome). */
export function HiglouMark({
  className,
  href = "/home",
}: {
  className?: string;
  href?: string;
}) {
  return (
    <a
      href={href}
      className={cn(
        "inline-flex items-center gap-2 text-foreground no-underline",
        className,
      )}
      aria-label="Higlou home"
    >
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-brand-foreground">
        <Sparkles className="h-5 w-5" strokeWidth={2.5} />
      </span>
      <span className="text-[22px] font-semibold tracking-tight">Higlou</span>
    </a>
  );
}

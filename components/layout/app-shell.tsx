import { AppSidebar } from "@/components/layout/app-sidebar";
import { cn } from "@/lib/utils";

export function AppShell({
  title,
  description,
  actions,
  children,
  hideHeader = false,
  contentClassName,
}: {
  title?: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  /** Home / conversational screens — no admin chrome title bar */
  hideHeader?: boolean;
  contentClassName?: string;
}) {
  return (
    <div className="flex min-h-screen bg-[#fafafa]">
      <div className="sticky top-0 hidden h-screen md:block">
        <AppSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        {!hideHeader && title ? (
          <header className="sticky top-0 z-20 bg-[#fafafa]/90 backdrop-blur-md">
            <div className="flex flex-col gap-3 px-5 py-6 sm:flex-row sm:items-end sm:justify-between sm:px-10 sm:py-8">
              <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
                  {title}
                </h1>
                {description ? (
                  <p className="mt-1.5 max-w-xl text-sm text-zinc-500">
                    {description}
                  </p>
                ) : null}
              </div>
              {actions ? (
                <div className="flex flex-wrap gap-2">{actions}</div>
              ) : null}
            </div>
          </header>
        ) : null}
        <main
          className={cn(
            "flex-1 px-5 pb-16 sm:px-10",
            hideHeader ? "pt-8 sm:pt-10" : "pt-2",
            contentClassName,
          )}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

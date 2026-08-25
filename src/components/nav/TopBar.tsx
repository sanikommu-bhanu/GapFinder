"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/cn";
import { AppMenu } from "./AppMenu";

/**
 * The screen header from the design reference: a centered title with an
 * optional back affordance on the left and the app menu on the right. Both
 * controls are 44px targets so they stay tappable on a phone.
 */
export function TopBar({
  title,
  subtitle,
  back = true,
  onBack,
  right,
  className,
  tone = "light",
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  /** Overrides history navigation — used by screens with internal steps. */
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
  tone?: "light" | "dark";
}) {
  const router = useRouter();
  const dark = tone === "dark";

  return (
    <header className={cn("flex items-center gap-1 px-2 pb-3 pt-3", className)}>
      <div className="flex w-11 shrink-0 justify-start">
        {back && (
          <button
            type="button"
            onClick={() => (onBack ? onBack() : router.back())}
            aria-label="Go back"
            className={cn(
              "flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-black/5",
              dark ? "text-white" : "text-navy-900"
            )}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
      </div>

      <div className="min-w-0 flex-1 text-center">
        <h1
          className={cn(
            "truncate font-display text-[17px] font-bold leading-tight",
            dark ? "text-white" : "text-navy-900"
          )}
        >
          {title}
        </h1>
        {subtitle && (
          <p className={cn("truncate text-xs", dark ? "text-white/60" : "text-ink-soft")}>{subtitle}</p>
        )}
      </div>

      <div className="flex w-11 shrink-0 justify-end">{right ?? <AppMenu tone={tone} />}</div>
    </header>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, MoreVertical } from "lucide-react";
import { cn } from "@/lib/cn";

export function TopBar({
  title,
  subtitle,
  back = true,
  onMenu,
  right,
  className,
}: {
  title: string;
  subtitle?: string;
  back?: boolean;
  onMenu?: () => void;
  right?: React.ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <header className={cn("flex items-start justify-between px-5 pt-4 pb-3", className)}>
      <div className="flex items-start gap-2">
        {back && (
          <button onClick={() => router.back()} className="mt-0.5 rounded-full p-1 text-navy-900">
            <ChevronLeft className="h-5 w-5" />
          </button>
        )}
        <div>
          <h1 className="font-display text-lg font-bold text-navy-900">{title}</h1>
          {subtitle && <p className="text-xs text-ink-soft">{subtitle}</p>}
        </div>
      </div>
      {right ?? (
        <button onClick={onMenu} className="rounded-full p-1 text-navy-900">
          <MoreVertical className="h-5 w-5" />
        </button>
      )}
    </header>
  );
}

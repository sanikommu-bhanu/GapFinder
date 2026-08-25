import { cn } from "@/lib/cn";

export function Chip({
  active,
  className,
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "rounded-pill border px-4 py-2 text-sm font-medium transition-colors",
        active ? "border-navy-900 bg-navy-50 text-navy-900" : "border-navy-50 bg-white text-ink-soft",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}

import { cn } from "@/lib/cn";
import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "ghost" | "outline";
type Size = "md" | "lg" | "icon";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary: "bg-navy-900 text-on-strong hover:bg-navy-700 active:bg-navy-950",
  secondary: "bg-lavender-100 text-navy-900 hover:bg-lavender-200",
  ghost: "bg-transparent text-navy-900 hover:bg-surface-muted",
  outline: "bg-transparent border border-navy-100 text-navy-900 hover:bg-surface-muted",
};

const sizes: Record<Size, string> = {
  md: "h-11 px-5 text-sm",
  lg: "h-14 px-6 text-base",
  icon: "h-11 w-11",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "lg", loading, children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-pill font-display font-semibold",
          "transition-colors duration-150 disabled:opacity-50 disabled:pointer-events-none",
          "active:scale-[0.98]",
          variants[variant],
          sizes[size],
          className
        )}
        {...props}
      >
        {loading ? (
          <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
        ) : (
          children
        )}
      </button>
    );
  }
);
Button.displayName = "Button";

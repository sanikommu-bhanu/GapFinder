import { cn } from "@/lib/cn";
import type { HTMLAttributes } from "react";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card bg-surface-card shadow-card p-4",
        className
      )}
      {...props}
    />
  );
}

export function GradientCard({
  className,
  variant = "lavender",
  ...props
}: HTMLAttributes<HTMLDivElement> & { variant?: "lavender" | "peach" | "brand" }) {
  const bg =
    variant === "peach"
      ? "bg-gradient-peach"
      : variant === "brand"
      ? "bg-gradient-brand"
      : "bg-gradient-lavender";
  return <div className={cn("rounded-card p-4 shadow-soft", bg, className)} {...props} />;
}

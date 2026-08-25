"use client";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/cn";

/**
 * A labelled input with room for an error message.
 *
 * The auth forms previously used bare inputs with placeholders as labels, which
 * disappear the moment you type and are invisible to a screen reader. This
 * keeps a real label, associates the error with the field, and lets a password
 * be revealed — the small things that make a sign-in feel finished.
 */
export const TextField = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string | null; hint?: string }
>(({ label, error, hint, className, type = "text", id, ...props }, ref) => {
  const [revealed, setRevealed] = useState(false);
  const fieldId = id ?? `field-${label.toLowerCase().replace(/\s+/g, "-")}`;
  const isPassword = type === "password";
  const describedBy = error ? `${fieldId}-error` : hint ? `${fieldId}-hint` : undefined;

  return (
    <div className={className}>
      <label htmlFor={fieldId} className="mb-1.5 block text-xs font-semibold text-ink-soft">
        {label}
      </label>
      <div className="relative">
        <input
          ref={ref}
          id={fieldId}
          type={isPassword && revealed ? "text" : type}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          className={cn(
            "h-12 w-full rounded-2xl border bg-surface-muted px-4 text-base text-navy-900 outline-none transition-colors focus:bg-surface",
            isPassword && "pr-12",
            error ? "border-danger" : "border-navy-50 focus:border-lavender-400"
          )}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="absolute right-1 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full text-ink-faint"
          >
            {revealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`${fieldId}-hint`} className="mt-1.5 text-xs text-ink-faint">
          {hint}
        </p>
      ) : null}
    </div>
  );
});

TextField.displayName = "TextField";

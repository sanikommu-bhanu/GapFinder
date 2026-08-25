"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/nav/TopBar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAppStore } from "@/store/useAppStore";

type Errors = { name?: string; email?: string; password?: string };

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Validated here as well as on the server, so mistakes surface immediately. */
  function validate(): boolean {
    const next: Errors = {};
    if (!name.trim()) next.name = "What should we call you?";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) next.email = "That doesn't look like an email address.";
    if (password.length < 8) next.password = "Use at least 8 characters.";
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!validate()) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (res.status === 409) setErrors({ email: "An account with this email already exists." });
        else setFormError(data.error ?? "We couldn't create your account. Please try again.");
        return;
      }
      setUser(data);
      router.push("/personalize");
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-surface px-6 pb-8">
      <TopBar title="" back right={<span />} className="px-0" />

      <h1 className="mt-2 font-display text-[26px] font-bold leading-tight text-navy-900">Create your account</h1>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
        Your work stays in your account, so GapFinder can tell what you&apos;ve already learned.
      </p>

      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
        <TextField
          label="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={errors.name}
          autoComplete="name"
          autoCapitalize="words"
        />
        <TextField
          label="Email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
          autoCapitalize="off"
        />
        <TextField
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          hint="At least 8 characters."
          autoComplete="new-password"
        />

        {formError && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" loading={loading} className="mt-2 w-full">
          Create account
        </Button>
      </form>

      <p className="mt-auto pt-8 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy-900">
          Log in
        </Link>
      </p>
    </div>
  );
}

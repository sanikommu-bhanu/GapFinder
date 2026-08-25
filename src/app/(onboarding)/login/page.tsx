"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { TopBar } from "@/components/nav/TopBar";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useAppStore } from "@/store/useAppStore";

export default function LoginPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const next: { email?: string; password?: string } = {};
    if (!email.trim()) next.email = "Enter your email.";
    if (!password) next.password = "Enter your password.";
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data.error ?? "That email and password don't match.");
        return;
      }
      setUser(data);
      router.push("/home");
    } catch {
      setFormError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-surface px-6 pb-8">
      <TopBar title="" back right={<span />} className="px-0" />

      <h1 className="mt-2 font-display text-[26px] font-bold leading-tight text-navy-900">Welcome back</h1>
      <p className="mt-1.5 text-sm text-ink-soft">Pick up where your reasoning left off.</p>

      <form onSubmit={onSubmit} noValidate className="mt-7 flex flex-col gap-4">
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
          autoComplete="current-password"
        />

        {formError && (
          <p role="alert" className="rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {formError}
          </p>
        )}

        <Button type="submit" loading={loading} className="mt-2 w-full">
          Log in
        </Button>
      </form>

      <p className="mt-auto pt-8 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/register" className="font-semibold text-navy-900">
          Create an account
        </Link>
      </p>
    </div>
  );
}

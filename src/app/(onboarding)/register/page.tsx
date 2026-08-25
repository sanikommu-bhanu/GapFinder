"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";

export default function RegisterPage() {
  const router = useRouter();
  const setUser = useAppStore((s) => s.setUser);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
      setUser(data);
      router.push("/personalize");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col justify-center bg-white px-6 py-10">
      <h1 className="font-display text-2xl font-bold text-navy-900">Create your account</h1>
      <p className="mt-1 text-sm text-ink-soft">Start finding where understanding breaks.</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-4">
        <input
          className="h-12 rounded-2xl border border-navy-50 bg-surface-muted px-4 text-sm outline-none focus:border-lavender-400"
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          type="email"
          className="h-12 rounded-2xl border border-navy-50 bg-surface-muted px-4 text-sm outline-none focus:border-lavender-400"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          type="password"
          className="h-12 rounded-2xl border border-navy-50 bg-surface-muted px-4 text-sm outline-none focus:border-lavender-400"
          placeholder="Password (min 6 characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
        />
        {error && <p className="text-sm text-danger">{error}</p>}
        <Button type="submit" loading={loading} className="mt-2 w-full">
          Continue
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-navy-900">
          Log in
        </Link>
      </p>
    </div>
  );
}

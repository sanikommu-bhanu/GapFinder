import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-lavender-50">
        <Compass className="h-7 w-7 text-lavender-500" />
      </span>
      <h1 className="mt-5 font-display text-xl font-bold text-navy-900">Nothing here</h1>
      <p className="mt-2 max-w-xs text-sm leading-relaxed text-ink-soft">
        That page doesn&apos;t exist. It may have been removed, or the link was mistyped.
      </p>
      <Link href="/home" className="mt-7 w-full max-w-xs">
        <Button className="w-full">Back to home</Button>
      </Link>
    </div>
  );
}

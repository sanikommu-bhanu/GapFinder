"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera as CameraIcon, Image as ImageIcon, Lightbulb, X, Keyboard, ScanLine } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/cn";
import { SUBJECTS } from "@/lib/subjects";
import { SubjectCapability } from "@/components/ui/SubjectCapability";

const MAX_FILE_BYTES = 6 * 1024 * 1024;

/**
 * A real worked solution with a real mistake, for anyone who wants to see what
 * the app does before finding their own homework.
 *
 * This is not a fixture or a canned result: pressing it fills the box, and the
 * submission runs the same pipeline as any other, producing its diagnosis live.
 * The mistake is in the distribution on line 2 — one line earlier than most
 * students assume when they check this kind of working.
 */
const EXAMPLE_WORK = [
  "2(3x-5) - 4(x+2) = 3(x-1) + 7",
  "6x - 10 - 4x + 8 = 3x - 1 + 7",
  "2x - 2 = 3x + 6",
  "2x - 3x = 6 + 2",
  "-x = 8",
  "x = -8",
].join("\n");

type Mode = "photo" | "typed";

export default function ScanPage() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<Mode>("photo");
  const [preview, setPreview] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mime: string } | null>(null);
  const [typed, setTyped] = useState("");
  const [subject, setSubject] = useState("Math");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setActiveAnalysis = useAppStore((s) => s.setActiveAnalysis);

  const typedLines = typed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Reset so choosing the same file twice still fires a change.
    e.target.value = "";
    if (!f) return;
    setError(null);

    if (!f.type.startsWith("image/")) {
      setError("That file isn't an image. Choose a photo of your written work.");
      return;
    }
    if (f.size > MAX_FILE_BYTES) {
      setError("That photo is over 6 MB. Try again with a smaller or lower-resolution image.");
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => setError("We couldn't read that file. Try choosing it again.");
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(",")[1] ?? "";
      if (!base64) {
        setError("We couldn't read that file. Try choosing it again.");
        return;
      }
      // The preview appears the instant the file is read — no waiting on the server.
      setPreview(result);
      setFileData({ base64, mime: f.type });
    };
    reader.readAsDataURL(f);
  }

  function clearImage() {
    setPreview(null);
    setFileData(null);
    setError(null);
  }

  async function analyze() {
    const body =
      mode === "typed"
        ? { subject, sourceType: "typed" as const, steps: typedLines }
        : fileData
          ? {
              subject,
              imageBase64: fileData.base64,
              imageMimeType: fileData.mime,
              sourceType: "gallery" as const,
            }
          : null;

    if (mode === "typed" && typedLines.length < 2) {
      setError("Write at least two lines — we compare each line against the one above it.");
      return;
    }
    if (!body) {
      setError("Take a photo or choose an image first.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Couldn't start the analysis. Please try again.");
      setActiveAnalysis(data.analysisId);
      router.push(`/analyzing?id=${data.analysisId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't start the analysis. Please try again.");
      setLoading(false);
    }
  }

  const canSubmit = mode === "typed" ? typedLines.length >= 2 : Boolean(fileData);

  return (
    <div className="pb-8">
      <TopBar title="Upload Your Work" />

      <div className="px-5">
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          Photograph your handwritten working, or type it out — we check every line either way.
        </p>

        <div className="mt-4 flex gap-1 rounded-pill bg-surface-muted p-1">
          {(
            [
              { value: "photo", label: "Photo", icon: ScanLine },
              { value: "typed", label: "Type it", icon: Keyboard },
            ] as const
          ).map((t) => (
            <button
              key={t.value}
              onClick={() => {
                setMode(t.value);
                setError(null);
              }}
              aria-pressed={mode === t.value}
              className={cn(
                "flex min-h-[40px] flex-1 items-center justify-center gap-1.5 rounded-pill text-sm font-medium transition-colors",
                mode === t.value ? "bg-white text-navy-900 shadow-card" : "text-ink-soft"
              )}
            >
              <t.icon className="h-4 w-4" />
              {t.label}
            </button>
          ))}
        </div>

        {mode === "photo" ? (
          <>
            <div className="relative mt-4">
              <Card className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted p-0">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Your uploaded work" className="h-full w-full object-contain" />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-8 text-center">
                    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface shadow-card">
                      <CameraIcon className="h-5 w-5 text-lavender-500" />
                    </span>
                    <p className="text-sm font-medium text-ink-soft">No photo yet</p>
                    <p className="text-xs leading-relaxed text-ink-faint">
                      Include every line you wrote — we need the whole chain to find where it broke.
                    </p>
                  </div>
                )}
              </Card>
              {preview && (
                <button
                  onClick={clearImage}
                  aria-label="Remove photo"
                  className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-navy-900/80 text-on-strong backdrop-blur"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraRef.current?.click()}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-surface-muted text-sm font-medium text-navy-900 active:scale-[0.98]"
              >
                <CameraIcon className="h-4 w-4" /> Camera
              </button>
              <button
                onClick={() => galleryRef.current?.click()}
                className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-surface-muted text-sm font-medium text-navy-900 active:scale-[0.98]"
              >
                <ImageIcon className="h-4 w-4" /> Gallery
              </button>
              <input
                ref={cameraRef}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={onFile}
              />
              <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
            </div>
          </>
        ) : (
          <div className="mt-4">
            <label htmlFor="typed-work" className="mb-1.5 block text-xs font-semibold text-ink-soft">
              Your working, one line per step
            </label>
            <textarea
              id="typed-work"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              rows={8}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={"2x + 7 = 15\n2x = 15 + 7\n2x = 22\nx = 11"}
              className="w-full resize-none rounded-2xl border border-navy-50 bg-surface-muted p-4 font-display text-base leading-relaxed text-navy-900 outline-none transition-colors placeholder:font-body placeholder:text-sm placeholder:text-ink-faint focus:border-lavender-400 focus:bg-surface"
            />
            <div className="mt-1.5 flex items-start justify-between gap-3 px-1">
              <p className="text-[11px] text-ink-faint">
                {typedLines.length === 0
                  ? "Start with the problem, then each step you took."
                  : `${typedLines.length} line${typedLines.length === 1 ? "" : "s"} — we'll check each against the one above it.`}
              </p>
              {typed.trim().length === 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setTyped(EXAMPLE_WORK);
                    setError(null);
                  }}
                  className="shrink-0 text-[11px] font-semibold text-lavender-600"
                >
                  Use an example
                </button>
              )}
            </div>
          </div>
        )}

        <div className="-mx-5 mt-4 flex gap-2 overflow-x-auto px-5 scrollbar-none">
          {SUBJECTS.map((s) => (
            <Chip key={s.name} active={subject === s.name} onClick={() => setSubject(s.name)} className="shrink-0">
              {s.name}
            </Chip>
          ))}
        </div>

        {/* Exactly what will be proved versus reviewed for the chosen subject.
            A student should never be told their chemistry is right when all we
            confirmed was the algebra inside it. */}
        <SubjectCapability subject={subject} className="mt-3" />

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button onClick={analyze} loading={loading} disabled={!canSubmit} className="mt-5 w-full">
          Analyze my work
        </Button>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-peach-500" />
          <p className="text-xs leading-relaxed text-ink-soft">
            {mode === "photo"
              ? "One problem per photo, written left to right. Clear steps let us reconstruct your reasoning instead of guessing at it."
              : "Include the original problem as your first line. We compare each step to the one above it, so the more you show, the more precisely we can locate the break."}
          </p>
        </div>
      </div>
    </div>
  );
}

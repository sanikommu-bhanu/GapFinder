"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera as CameraIcon, Image as ImageIcon, Lightbulb, X } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";

const SUBJECTS = ["Math", "Physics", "Chemistry"];
const MAX_FILE_BYTES = 6 * 1024 * 1024;

export default function ScanPage() {
  const router = useRouter();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mime: string } | null>(null);
  const [subject, setSubject] = useState("Math");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setActiveAnalysis = useAppStore((s) => s.setActiveAnalysis);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    // Reset the input so choosing the same file twice still fires a change.
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
    if (!fileData) {
      setError("Take a photo or choose an image first.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/analyses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          imageBase64: fileData.base64,
          imageMimeType: fileData.mime,
          sourceType: "gallery",
        }),
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

  return (
    <div className="pb-8">
      <TopBar title="Upload Your Work" />

      <div className="px-5">
        <p className="text-center text-[13px] leading-relaxed text-ink-soft">
          Take a clear photo of your handwritten work, or upload one from your gallery.
        </p>

        <div className="relative mt-4">
          <Card className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted p-0">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Your uploaded work" className="h-full w-full object-contain" />
            ) : (
              <div className="flex flex-col items-center gap-2 px-8 text-center">
                <span className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-card">
                  <CameraIcon className="h-5 w-5 text-lavender-500" />
                </span>
                <p className="text-sm font-medium text-ink-soft">No photo yet</p>
                <p className="text-xs text-ink-faint">
                  Include every line you wrote — we need the whole chain to find where it broke.
                </p>
              </div>
            )}
          </Card>
          {preview && (
            <button
              onClick={clearImage}
              aria-label="Remove photo"
              className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full bg-navy-900/80 text-white backdrop-blur"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto scrollbar-none">
          {SUBJECTS.map((s) => (
            <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
              {s}
            </Chip>
          ))}
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

        {error && (
          <p role="alert" className="mt-3 rounded-2xl bg-danger-50 px-4 py-3 text-sm text-danger">
            {error}
          </p>
        )}

        <Button onClick={analyze} loading={loading} disabled={!fileData} className="mt-5 w-full">
          Analyze Work
        </Button>

        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-surface-muted p-3">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-peach-500" />
          <p className="text-xs leading-relaxed text-ink-soft">
            One problem per photo, written left to right. Clear steps let us reconstruct your reasoning instead of
            guessing at it.
          </p>
        </div>
      </div>
    </div>
  );
}

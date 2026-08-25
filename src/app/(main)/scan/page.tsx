"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera as CameraIcon, Image as ImageIcon } from "lucide-react";
import { TopBar } from "@/components/nav/TopBar";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { useAppStore } from "@/store/useAppStore";

const SUBJECTS = ["Math", "Physics", "Chemistry"];

export default function ScanPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileData, setFileData] = useState<{ base64: string; mime: string } | null>(null);
  const [subject, setSubject] = useState("Math");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isDemoMode = useAppStore((s) => s.isDemoMode);
  const setActiveAnalysis = useAppStore((s) => s.setActiveAnalysis);

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      setPreview(result);
      const base64 = result.split(",")[1] ?? "";
      setFileData({ base64, mime: f.type || "image/jpeg" });
    };
    reader.readAsDataURL(f);
  }

  async function analyze() {
    setLoading(true);
    setError(null);
    try {
      if (isDemoMode) {
        // Route straight to the pre-seeded deterministic demo analysis —
        // zero live Gemini calls.
        setActiveAnalysis("demo-analysis-1");
        router.push("/analyzing?id=demo-analysis-1&demo=1");
        return;
      }
      if (!fileData) {
        setError("Take a photo or choose an image first.");
        setLoading(false);
        return;
      }
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
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Couldn't analyze this image.");
      setActiveAnalysis(data.analysisId);
      router.push(`/analyzing?id=${data.analysisId}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="pb-6">
      <TopBar title="Upload Your Work" subtitle="Take a clear photo of your handwriting work or upload from gallery." />

      <div className="px-5">
        <Card className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-surface-muted p-0">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Uploaded work" className="h-full w-full object-cover" />
          ) : isDemoMode ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src="/demo/handwriting-sample.png" alt="Demo handwriting sample" className="h-full w-full object-cover" />
          ) : (
            <p className="px-6 text-center text-sm text-ink-faint">No image selected yet</p>
          )}
        </Card>

        <div className="mt-4 flex gap-2">
          {SUBJECTS.map((s) => (
            <Chip key={s} active={subject === s} onClick={() => setSubject(s)}>
              {s}
            </Chip>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-surface-muted text-sm font-medium text-navy-900"
          >
            <CameraIcon className="h-4 w-4" /> Camera
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-surface-muted text-sm font-medium text-navy-900"
          >
            <ImageIcon className="h-4 w-4" /> Gallery
          </button>
          <input ref={fileRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <Button onClick={analyze} loading={loading} className="mt-5 w-full">
          Analyze Work
        </Button>
        <p className="mt-3 text-center text-xs text-ink-faint">Supports: Math, Physics, Chemistry</p>
      </div>
    </div>
  );
}

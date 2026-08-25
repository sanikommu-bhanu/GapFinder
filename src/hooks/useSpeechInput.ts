"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Voice input via the browser's own SpeechRecognition.
 *
 * Speaking an explanation out loud is how a student would actually teach
 * something back, and it costs nothing to support where the browser already
 * can. Where it can't, `supported` is false and the caller shows a keyboard
 * instead — the feature degrades to typing rather than to a dead button.
 */

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: any) => void) | null;
  onerror: ((e: any) => void) | null;
  onend: (() => void) | null;
};

function getRecognitionCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as (new () => SpeechRecognitionLike) | null;
}

export function useSpeechInput(options: { onTranscript: (text: string) => void; lang?: string }) {
  const { onTranscript, lang = "en-US" } = options;
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const onTranscriptRef = useRef(onTranscript);

  // Keep the latest callback without re-creating the recognizer on every render.
  useEffect(() => {
    onTranscriptRef.current = onTranscript;
  }, [onTranscript]);

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => {
      recognitionRef.current?.abort();
      recognitionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setError("This browser can't do voice input. Type your explanation instead.");
      return;
    }
    setError(null);

    const recognition = new Ctor();
    recognition.lang = lang;
    recognition.continuous = true;
    recognition.interimResults = false;

    recognition.onresult = (event: any) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) text += event.results[i][0].transcript;
      }
      if (text.trim()) onTranscriptRef.current(text.trim());
    };

    recognition.onerror = (event: any) => {
      setListening(false);
      setError(
        event?.error === "not-allowed"
          ? "Microphone access was blocked. Allow it in your browser, or type instead."
          : event?.error === "no-speech"
            ? "We didn't catch that. Try again, or type your explanation."
            : "Voice input stopped unexpectedly. You can type instead."
      );
    };

    recognition.onend = () => setListening(false);

    try {
      recognition.start();
      recognitionRef.current = recognition;
      setListening(true);
    } catch {
      setError("Couldn't start voice input. Type your explanation instead.");
      setListening(false);
    }
  }, [lang]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, error, start, stop, toggle };
}

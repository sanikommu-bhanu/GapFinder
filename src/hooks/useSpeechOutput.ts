"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Spoken output via the browser's own speech synthesis.
 *
 * Keyless and offline — no paid voice provider, which matters because the
 * product must not become dependent on one. Where the browser can't speak,
 * `supported` is false and the caller falls back to animated written teaching
 * rather than hiding the lesson behind a capability the device lacks.
 *
 * Progress is reported per sentence rather than per character: `onBoundary`
 * fires inconsistently across engines, but sentence boundaries are reliable
 * because each sentence is queued as its own utterance.
 */

export interface SpeechOutput {
  supported: boolean;
  speaking: boolean;
  paused: boolean;
  /** Index of the sentence currently being spoken, or -1. */
  currentIndex: number;
  speak: (sentences: string[]) => void;
  pause: () => void;
  resume: () => void;
  stop: () => void;
}

export function useSpeechOutput(options: { rate?: number } = {}): SpeechOutput {
  const { rate = 1 } = options;
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [paused, setPaused] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const cancelled = useRef(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
    return () => {
      // A page change must not leave the browser talking to an empty room.
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const stop = useCallback(() => {
    cancelled.current = true;
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setPaused(false);
    setCurrentIndex(-1);
  }, []);

  const speak = useCallback(
    (sentences: string[]) => {
      if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
      const synth = window.speechSynthesis;
      synth.cancel();
      cancelled.current = false;

      const clean = sentences.map((s) => s.trim()).filter(Boolean);
      if (clean.length === 0) return;

      setSpeaking(true);
      setPaused(false);

      clean.forEach((sentence, i) => {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.rate = rate;
        utterance.pitch = 1;
        utterance.onstart = () => {
          if (!cancelled.current) setCurrentIndex(i);
        };
        if (i === clean.length - 1) {
          utterance.onend = () => {
            if (cancelled.current) return;
            setSpeaking(false);
            setCurrentIndex(-1);
          };
        }
        utterance.onerror = () => {
          if (i === clean.length - 1) {
            setSpeaking(false);
            setCurrentIndex(-1);
          }
        };
        synth.speak(utterance);
      });
    },
    [rate]
  );

  const pause = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.pause();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.resume();
    setPaused(false);
  }, []);

  return { supported, speaking, paused, currentIndex, speak, pause, resume, stop };
}

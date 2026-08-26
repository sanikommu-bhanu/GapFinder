"use client";
import { useEffect, useState } from "react";

/**
 * The student's own voice preferences, read once per screen.
 *
 * These were being saved and then ignored: the settings screen wrote a speaking
 * rate to the user record, and every component that actually spoke used the
 * default. A preference that visibly does nothing is worse than no preference,
 * because it teaches the student that the settings screen is decorative.
 *
 * Defaults are chosen so a failed fetch behaves exactly like a fresh account —
 * voice offered, normal speed — rather than silently disabling anything.
 */

export interface VoiceSettings {
  /** Whether to offer microphone input at all. */
  voiceEnabled: boolean;
  /** Speech synthesis rate, 1 being normal. */
  voiceSpeed: number;
  loaded: boolean;
}

const DEFAULTS: VoiceSettings = { voiceEnabled: true, voiceSpeed: 1, loaded: false };

export function useVoiceSettings(): VoiceSettings {
  const [settings, setSettings] = useState<VoiceSettings>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;

    fetch("/api/settings")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled) return;
        const speed = Number(data?.settings?.voiceSpeed);
        setSettings({
          voiceEnabled: data?.settings?.voiceEnabled ?? true,
          // Guard the range: a corrupt value must not make speech unusable.
          voiceSpeed: Number.isFinite(speed) && speed >= 0.5 && speed <= 2 ? speed : 1,
          loaded: true,
        });
      })
      .catch(() => {
        if (!cancelled) setSettings({ ...DEFAULTS, loaded: true });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return settings;
}

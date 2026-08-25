"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export interface Appearance {
  accentColor: string;
  fontScale: number;
}

const DEFAULTS: Appearance = { accentColor: "purple", fontScale: 1 };
const STORAGE_KEY = "gapfinder-appearance";

interface AppearanceContextValue extends Appearance {
  /** Applies immediately, persists locally, and saves to the account. */
  update: (patch: Partial<Appearance>) => void;
}

const AppearanceContext = createContext<AppearanceContextValue>({ ...DEFAULTS, update: () => {} });

export const useAppearance = () => useContext(AppearanceContext);

function readLocal(): Appearance {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Appearance>) };
  } catch {
    return DEFAULTS;
  }
}

function apply(appearance: Appearance) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-accent", appearance.accentColor);
  root.style.setProperty("--font-scale", String(appearance.fontScale));
}

/**
 * Applies the student's appearance settings to the live document.
 *
 * Accent and text size were previously saved to the account and then ignored —
 * settings that changed nothing. This makes them real: the choice lands
 * instantly from local storage and is reconciled with the account copy so it
 * follows the student across devices.
 *
 * There is no theme switch. GapFinder ships one bright palette by design (see
 * theme.css); text size is the accessibility control that matters here, and it
 * scales the entire interface rather than one screen.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULTS);

  // Local first, so there is no flash of the wrong accent while the fetch runs.
  useEffect(() => {
    setAppearance(readLocal());
  }, []);

  // Then reconcile with the account, the source of truth across devices.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.settings) return;
        setAppearance((current) => {
          const next: Appearance = {
            accentColor: d.settings.accentColor ?? current.accentColor,
            fontScale: d.settings.fontScale ?? current.fontScale,
          };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Private browsing can refuse writes; the setting still applies.
          }
          return next;
        });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    apply(appearance);
  }, [appearance]);

  const update = useCallback((patch: Partial<Appearance>) => {
    setAppearance((current) => {
      const next = { ...current, ...patch };
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        // Non-fatal.
      }
      void fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      }).catch(() => {});
      return next;
    });
  }, []);

  const value = useMemo<AppearanceContextValue>(() => ({ ...appearance, update }), [appearance, update]);

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

/**
 * Runs before first paint so the chosen accent and text size are already on
 * <html> when the page appears, instead of snapping in after hydration.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var a = raw ? JSON.parse(raw) : {};
    var r = document.documentElement;
    if (a.accentColor) r.setAttribute("data-accent", a.accentColor);
    if (a.fontScale) r.style.setProperty("--font-scale", String(a.fontScale));
  } catch (e) {}
})();
`;

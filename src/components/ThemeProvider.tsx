"use client";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type ThemeChoice = "light" | "dark" | "system";

export interface Appearance {
  theme: ThemeChoice;
  accentColor: string;
  fontScale: number;
}

const DEFAULTS: Appearance = { theme: "system", accentColor: "purple", fontScale: 1 };
const STORAGE_KEY = "gapfinder-appearance";

interface ThemeContextValue extends Appearance {
  /** Applies immediately, persists locally, and saves to the account. */
  update: (patch: Partial<Appearance>) => void;
  /** What the page is actually rendering right now. */
  resolvedTheme: "light" | "dark";
}

const ThemeContext = createContext<ThemeContextValue>({
  ...DEFAULTS,
  update: () => {},
  resolvedTheme: "light",
});

export const useAppearance = () => useContext(ThemeContext);

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

function apply(appearance: Appearance, systemDark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const resolved = appearance.theme === "system" ? (systemDark ? "dark" : "light") : appearance.theme;
  root.setAttribute("data-theme", resolved);
  root.setAttribute("data-accent", appearance.accentColor);
  root.style.setProperty("--font-scale", String(appearance.fontScale));
  // Keeps the browser's own UI (address bar, form controls) in step.
  root.style.colorScheme = resolved;
}

/**
 * Applies the student's appearance settings to the live document.
 *
 * Theme, accent and text size were previously saved to the account and then
 * ignored — three settings screens that changed nothing. This makes them real:
 * the choice lands instantly from local storage, is confirmed against the
 * server copy so it follows the student across devices, and tracks the OS
 * setting while the theme is "system".
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [appearance, setAppearance] = useState<Appearance>(DEFAULTS);
  const [systemDark, setSystemDark] = useState(false);

  // Local first, so there's no flash of the wrong theme while the fetch runs.
  useEffect(() => {
    const local = readLocal();
    setAppearance(local);
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setSystemDark(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  // Then reconcile with the account, which is the source of truth across devices.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.settings) return;
        setAppearance((current) => {
          const next: Appearance = {
            theme: (d.settings.theme as ThemeChoice) ?? current.theme,
            accentColor: d.settings.accentColor ?? current.accentColor,
            fontScale: d.settings.fontScale ?? current.fontScale,
          };
          try {
            window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
          } catch {
            // Private browsing can refuse writes; the theme still applies.
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
    apply(appearance, systemDark);
  }, [appearance, systemDark]);

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

  const value = useMemo<ThemeContextValue>(
    () => ({
      ...appearance,
      update,
      resolvedTheme: appearance.theme === "system" ? (systemDark ? "dark" : "light") : appearance.theme,
    }),
    [appearance, systemDark, update]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Runs before first paint so the correct theme is already on <html> when the
 * page appears — without it, a dark-mode user sees a white flash on every load.
 */
export const themeBootstrapScript = `
(function(){
  try {
    var raw = localStorage.getItem(${JSON.stringify(STORAGE_KEY)});
    var a = raw ? JSON.parse(raw) : {};
    var theme = a.theme || "system";
    var dark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var r = document.documentElement;
    r.setAttribute("data-theme", dark ? "dark" : "light");
    if (a.accentColor) r.setAttribute("data-accent", a.accentColor);
    if (a.fontScale) r.style.setProperty("--font-scale", String(a.fontScale));
    r.style.colorScheme = dark ? "dark" : "light";
  } catch (e) {}
})();
`;

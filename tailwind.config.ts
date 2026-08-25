import type { Config } from "tailwindcss";

/**
 * Colours resolve through CSS variables (see src/app/theme.css) so a theme or
 * accent change is a variable swap rather than a per-component rewrite. The
 * `<alpha-value>` placeholder keeps Tailwind's opacity modifiers working —
 * `bg-navy-900/40` still does what it looks like.
 */
const v = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: v("navy-900"),
          50: v("navy-50"),
          100: v("navy-100"),
          400: v("navy-400"),
          700: v("navy-700"),
          900: v("navy-900"),
          950: v("navy-950"),
        },
        lavender: {
          50: v("lavender-50"),
          100: v("lavender-100"),
          200: v("lavender-200"),
          300: v("lavender-300"),
          400: v("lavender-400"),
          500: v("lavender-500"),
          600: v("lavender-600"),
        },
        peach: {
          50: v("peach-50"),
          100: v("peach-100"),
          200: v("peach-200"),
          300: v("peach-300"),
          400: v("peach-400"),
          500: v("peach-500"),
        },
        success: { DEFAULT: v("success"), 50: v("success-50") },
        warning: { DEFAULT: v("warning"), 50: v("warning-50") },
        danger: { DEFAULT: v("danger"), 50: v("danger-50") },
        surface: {
          DEFAULT: v("surface"),
          muted: v("surface-muted"),
          card: v("surface-card"),
        },
        ink: {
          DEFAULT: v("ink"),
          soft: v("ink-soft"),
          faint: v("ink-faint"),
        },
        /** Sits on top of a navy-900 surface — flips with the theme. */
        "on-strong": v("on-strong"),
      },
      fontFamily: {
        display: ["var(--font-display)", "system-ui", "sans-serif"],
        body: ["var(--font-body)", "system-ui", "sans-serif"],
      },
      borderRadius: {
        xl2: "1.25rem",
        xl3: "1.75rem",
        card: "1.5rem",
        pill: "999px",
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        floating: "var(--shadow-floating)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #C3B4F7 0%, #FFB27A 100%)",
        "gradient-lavender": "linear-gradient(135deg, rgb(var(--c-lavender-100)) 0%, rgb(var(--c-lavender-200)) 100%)",
        "gradient-peach": "linear-gradient(135deg, rgb(var(--c-peach-50)) 0%, rgb(var(--c-peach-200)) 100%)",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "pop-in": {
          "0%": { opacity: "0", transform: "scale(0.92)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.35s ease-out both",
        "pop-in": "pop-in 0.3s cubic-bezier(0.34,1.56,0.64,1) both",
        shimmer: "shimmer 2s linear infinite",
      },
    },
  },
  plugins: [],
};

export default config;

import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#151833",
          50: "#EDEEF5",
          100: "#D3D5E6",
          400: "#4A4F79",
          700: "#20244A",
          900: "#151833",
          950: "#0E1026",
        },
        lavender: {
          50: "#F6F4FE",
          100: "#EDE9FD",
          200: "#DCD4FB",
          300: "#C3B4F7",
          400: "#A78BFA",
          500: "#8B5CF6",
          600: "#7C4DEF",
        },
        peach: {
          50: "#FFF6EF",
          100: "#FFEBDD",
          200: "#FFD3B0",
          300: "#FFB27A",
          400: "#FF9857",
          500: "#FB8A3C",
        },
        success: { DEFAULT: "#2FBF71", 50: "#E7F9EF" },
        warning: { DEFAULT: "#F5A623", 50: "#FFF6E5" },
        danger: { DEFAULT: "#EF5A5A", 50: "#FDECEC" },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F7F6FB",
          card: "#FFFFFF",
        },
        ink: {
          DEFAULT: "#151833",
          soft: "#6B6E8A",
          faint: "#A0A3BD",
        },
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
        soft: "0 8px 24px -8px rgba(21, 24, 51, 0.12)",
        card: "0 4px 20px -6px rgba(21, 24, 51, 0.10)",
        floating: "0 12px 32px -8px rgba(21, 24, 51, 0.18)",
      },
      backgroundImage: {
        "gradient-brand": "linear-gradient(135deg, #C3B4F7 0%, #FFB27A 100%)",
        "gradient-lavender": "linear-gradient(135deg, #EDE9FD 0%, #DCD4FB 100%)",
        "gradient-peach": "linear-gradient(135deg, #FFF6EF 0%, #FFD3B0 100%)",
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

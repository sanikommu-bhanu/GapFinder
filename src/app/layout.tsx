import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";
import { ThemeProvider, themeBootstrapScript } from "@/components/ThemeProvider";

const sora = Sora({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700", "800"],
  display: "swap",
});
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "GapFinder",
  description: "Don't just find the wrong answer. Find where understanding broke.",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, title: "GapFinder", statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F7F6FB" },
    { media: "(prefers-color-scheme: dark)", color: "#121426" },
  ],
  width: "device-width",
  initialScale: 1,
  // Pinch-zoom stays available: locking it out fails WCAG 1.4.4 and makes the
  // app unusable for anyone who needs to magnify a step.
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        {/* Sets the theme before first paint so there's no white flash. */}
        <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
          <div className="app-shell status-bar-safe">{children}</div>
        </ThemeProvider>
      </body>
    </html>
  );
}

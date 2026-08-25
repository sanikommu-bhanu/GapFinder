import type { Metadata, Viewport } from "next";
import { Sora, Inter } from "next/font/google";
import "./globals.css";

const sora = Sora({ subsets: ["latin"], variable: "--font-display", weight: ["500", "600", "700", "800"] });
const inter = Inter({ subsets: ["latin"], variable: "--font-body", weight: ["400", "500", "600"] });

export const metadata: Metadata = {
  title: "GapFinder",
  description: "Don't just find the wrong answer. Find where understanding broke.",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#151833",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sora.variable} ${inter.variable}`}>
      <body className="font-body antialiased">
        <div className="app-shell status-bar-safe">{children}</div>
      </body>
    </html>
  );
}

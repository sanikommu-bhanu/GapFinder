import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The verification layer is the part of this product that must never be
    // wrong, so its coverage is reported separately from everything else.
    coverage: {
      include: ["src/lib/math/**", "src/lib/verification/**", "src/lib/ai/**"],
      reporter: ["text-summary"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});

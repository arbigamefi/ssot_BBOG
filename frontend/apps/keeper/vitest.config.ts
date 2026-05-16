import { defineConfig } from "vitest/config";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root: __dirname,
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node"
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "src")
    }
  }
});

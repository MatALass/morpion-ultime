import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  esbuild: {
    // Treat test files and js/ source as ESM even without "type":"module"
    format: "esm",
  },
});

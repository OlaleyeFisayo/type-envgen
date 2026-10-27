import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Generated outputs import { json } from "type-envgen"; point it at the source.
export default defineConfig({
  resolve: { alias: { "type-envgen": fileURLToPath(new URL("./src/index.ts", import.meta.url)) } },
  test: { include: ["src/**/*.test.ts"], globalSetup: ["./src/core/test/utils/clean-output.ts"], isolate: false },
});

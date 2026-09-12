import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./", import.meta.url)), "server-only": fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url)) } },
  test: {
    include: ["tests/unit/**/*.test.ts", "tests/authz/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["lib/domain/**", "lib/authz/**"],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
      reporter: ["text", "html"],
    },
  },
});

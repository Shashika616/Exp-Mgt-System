import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "./db/load-env";

loadEnv();

/**
 * e2e: golden paths (requirements.md §10), IDOR + authz abuse cases, client snapshot test.
 * Runs against a production build with the local auth/storage/email(log) providers and the seeded demo DB.
 * `globalSetup` resets + seeds the database so every run starts from the same state.
 */
export default defineConfig({
  testDir: "tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] }, testIgnore: /portal-mobile/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /portal-mobile/ },
  ],
  webServer: {
    command: "pnpm exec next start -p 3100",
    url: "http://localhost:3100/login",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { APP_ENV: "test", APP_URL: "http://localhost:3100", NODE_ENV: "production", RATE_LIMIT_SCALE: "20" },
  },
});

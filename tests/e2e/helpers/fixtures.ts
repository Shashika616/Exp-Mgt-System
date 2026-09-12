import { test as base, type BrowserContext } from "@playwright/test";

/**
 * Tracks contexts a test opens via `browser.newContext()` and closes them afterwards (even on failure),
 * so EventSource connections never leak into the next test. The default `page` fixture is untouched.
 */
export const test = base.extend<{ trackedContexts: BrowserContext[] }>({
  trackedContexts: async ({ browser }, use) => {
    const before = new Set(browser.contexts());
    const opened: BrowserContext[] = [];
    await use(opened);
    for (const ctx of browser.contexts()) if (!before.has(ctx)) await ctx.close().catch(() => undefined);
  },
});
test.beforeEach(async ({ trackedContexts }) => void trackedContexts);
export { expect } from "@playwright/test";

import { expect, type Browser, type Page } from "@playwright/test";
import * as OTPAuth from "otpauth";
import { DEMO_PASSWORD, DEMO_TOTP_SECRET, DEMO_USERS } from "@/db/seed/demo";

export const USERS = {
  admin: DEMO_USERS.admin.email,
  lead: DEMO_USERS.lead.email,
  agent: DEMO_USERS.agent1.email,
  agent2: DEMO_USERS.agent2.email,
  dev: DEMO_USERS.dev1.email,
  dev2: DEMO_USERS.dev2.email,
  clientAdmin: "sanduni@ceylonagro.example",
  clientUser: "priyantha@ceylonagro.example",
  otherOrgUser: "roshan@serendibfreight.example",
};

export function totp(): string {
  return new OTPAuth.TOTP({ secret: OTPAuth.Secret.fromBase32(DEMO_TOTP_SECRET), digits: 6, period: 30 }).generate();
}

/** Password login (+ TOTP for admin/lead). Returns once the home dashboard has rendered. */
export async function login(page: Page, email: string, password = DEMO_PASSWORD): Promise<void> {
  await page.goto("/login");
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  const code = page.getByLabel("Authentication code");
  const home = page.locator("main#main");
  await expect(code.or(home).first()).toBeVisible({ timeout: 30_000 });
  if (await code.isVisible()) {
    await code.fill(totp());
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(home).toBeVisible({ timeout: 30_000 });
  }
  await page.waitForURL(/\/(app|portal)/);
}

export async function newSession(browser: Browser, email: string, opts: { mobile?: boolean } = {}): Promise<Page> {
  const ctx = await browser.newContext(opts.mobile ? { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true } : {});
  const page = await ctx.newPage();
  await login(page, email);
  return page;
}

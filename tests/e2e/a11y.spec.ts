import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";

/** design.md §12.11 - axe passes with zero violations on the main screens (WCAG 2.2 AA tags). */
const TAGS = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"];

async function audit(page: import("@playwright/test").Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(TAGS).exclude("[data-nextjs-toast]").exclude("nextjs-portal").analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target.join(" ")).slice(0, 3).join(", ")})`), `axe violations on ${path}`).toEqual([]);
}

test("login page", async ({ page }) => audit(page, "/login"));

test("staff screens", async ({ browser }) => {
  const admin = await newSession(browser, USERS.admin);
  for (const p of ["/app", "/app/tickets", "/app/review", "/app/clients", "/app/reports", "/app/admin/users", "/app/admin/sla", "/app/admin/audit", "/app/tickets/new"]) await audit(admin, p);
  await admin.goto("/app/tickets");
  await admin.locator("tbody tr").first().click();
  await admin.waitForURL(/EXP-/);
  await audit(admin, admin.url());
});

test("developer dashboard", async ({ browser }) => {
  const dev = await newSession(browser, USERS.dev);
  await audit(dev, "/app");
});

test("client portal screens", async ({ browser }) => {
  const client = await newSession(browser, USERS.clientAdmin);
  for (const p of ["/portal", "/portal/new", "/portal/team", "/portal/account"]) await audit(client, p);
  await client.goto("/portal");
  await client.locator('[data-testid^="request-"]').first().click();
  await client.waitForURL(/EXP-/);
  await audit(client, client.url());
});

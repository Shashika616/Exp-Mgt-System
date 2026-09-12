import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";

/**
 * Golden path 5: admin changes a workflow setting, adds a category, edits an email template, then sees all
 * three in the audit log. (FR-ADM-02/04/05/06). Auto-close was removed by owner decision, so the setting
 * changed here is the developer-reply policy.
 */
test("GP5 admin console changes land in the audit log", async ({ browser }) => {
  const admin = await newSession(browser, USERS.admin);
  await admin.goto("/app/admin/settings");
  await admin.getByLabel("Developer replies to clients").selectOption("after_first_admin_reply");
  await admin.getByRole("button", { name: "Save settings" }).click();
  await expect(admin.getByText("Settings saved")).toBeVisible();

  await admin.goto("/app/admin/categories");
  await admin.getByTestId("category-name").fill("Mobile app");
  await admin.getByTestId("category-save").click();
  await expect(admin.getByText('Category "Mobile app" added')).toBeVisible();

  await admin.goto("/app/admin/templates");
  await admin.getByTestId("template-status_resolved").click();
  await admin.getByTestId("template-subject").fill("[{{ticket.key}}] Resolved: please confirm within 3 days");
  await admin.getByTestId("template-save").click();
  await expect(admin.getByText("Template saved")).toBeVisible();

  await admin.goto("/app/admin/audit");
  const rows = admin.getByTestId("audit-row");
  await expect(rows.filter({ hasText: "settings.updated" }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "category.created" }).first()).toBeVisible();
  await expect(rows.filter({ hasText: "template.updated" }).first()).toBeVisible();
  await expect(rows.filter({ hasText: USERS.admin }).first()).toBeVisible();

  // Filtering + CSV export
  await admin.getByLabel("Action").fill("category.created");
  await admin.getByRole("button", { name: "Filter" }).click();
  await expect(rows.first()).toContainText("category.created");
  const csv = await admin.request.get("/api/admin/audit.csv?action=category.created");
  expect(csv.ok()).toBeTruthy();
  expect(await csv.text()).toContain("category.created");

  // Restore the policy so other specs keep the default behaviour
  await admin.goto("/app/admin/settings");
  await admin.getByLabel("Developer replies to clients").selectOption("always");
  await admin.getByRole("button", { name: "Save settings" }).click();
  await expect(admin.getByText("Settings saved")).toBeVisible();
  await admin.context().close();
});

test("agents cannot open the admin console", async ({ browser }) => {
  const agent = await newSession(browser, USERS.agent);
  await agent.goto("/app/admin/audit");
  await expect(agent).not.toHaveURL(/\/app\/admin/);
  const csv = await agent.request.get("/api/admin/audit.csv");
  expect(csv.status()).toBe(401);
  await agent.context().close();
});

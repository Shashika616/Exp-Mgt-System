import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";
import { adminSql } from "./helpers/db";
import { lastEmailTo, linkFrom } from "./helpers/outbox";

/**
 * Golden path 4: client admin invites a colleague → colleague accepts, later signs in via magic link → sees the
 * org's tickets → cannot see another org's ticket by URL (404, access_denied logged). FR-AUTH-01/02/04, FR-CP-04, IDOR.
 */
test("GP4 invite → magic link → org scope → IDOR 404", async ({ browser, page }) => {
  const admin = await newSession(browser, USERS.clientAdmin);
  await admin.goto("/portal/team");
  await admin.getByTestId("invite-colleague").click();
  await admin.getByTestId("colleague-name").fill("Kavindya Perera");
  const email = "kavindya@ceylonagro.example";
  await admin.getByTestId("colleague-email").fill(email);
  await admin.getByTestId("invite-colleague-send").click();
  await expect(admin.getByText(`Invitation sent to ${email}`)).toBeVisible();
  await expect(admin.getByText("Kavindya Perera")).toBeVisible();

  // Accept the invitation from the email (single-use, sets password)
  const invite = await lastEmailTo(email, "invitation");
  const url = linkFrom(invite, "/invite/");
  await page.goto(url);
  await expect(page.getByRole("heading", { name: "Welcome" })).toBeVisible();
  await page.getByLabel("New password").fill("Kavindya-Portal-2026!");
  await page.getByLabel("Confirm password").fill("Kavindya-Portal-2026!");
  await page.getByRole("button", { name: "Accept invitation" }).click();
  await page.waitForURL(/\/portal/);
  // Replaying the link fails
  await page.goto(url);
  await expect(page.getByText("Invitation already used")).toBeVisible();

  // Sign out, then sign in via magic link
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByRole("tab", { name: "Email link" }).click();
  await page.getByLabel("Email").last().fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByText("Check your email")).toBeVisible();
  const magic = await lastEmailTo(email, "auth_magic_link");
  await page.goto(linkFrom(magic, "/magic-link/"));
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/portal/);

  // Sees the org's tickets (client_user: own + participant only → seed gives none; org admin scope not applicable)
  await page.goto("/portal?scope=all");
  await expect(page.getByRole("heading", { name: /Hi Kavindya/ })).toBeVisible();

  // Another org's ticket by URL → 404 and an access_denied audit row
  const sql = adminSql();
  const [other] = await sql<{ key: string }[]>`select t.key from tickets t join organisations o on o.id = t.org_id where o.slug = 'serendib-freight' limit 1`;
  const res = await page.goto(`/portal/tickets/${other!.key}`);
  expect(res!.status()).toBe(404);
  await expect(page.getByText("We couldn't find that")).toBeVisible();
  const [denied] = await sql<{ n: number }[]>`select count(*)::int as n from audit_log where action = 'access_denied' and entity_id = ${other!.key} and actor_email = ${email}`;
  expect(denied!.n).toBeGreaterThanOrEqual(1);
  // Same-org ticket the new user is not on → also hidden (client_user scope)
  const [own] = await sql<{ key: string }[]>`select t.key from tickets t join organisations o on o.id = t.org_id where o.slug = 'ceylon-agro' limit 1`;
  const res2 = await page.goto(`/portal/tickets/${own!.key}`);
  expect(res2!.status()).toBe(404);
  await sql.end();
  await admin.context().close();
});

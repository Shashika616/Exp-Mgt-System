import { expect, test } from "./helpers/fixtures";
import { USERS, login, newSession } from "./helpers/auth";
import { lastEmailTo } from "./helpers/outbox";

/**
 * Golden path 1: client raises an incident → confirmation → agent takes it → asks a question (pending_client)
 * → client replies → agent resolves → client confirms → closed. SLA clocks and notifications correct throughout.
 * Covers FR-CP-01, FR-CP-02, FR-CP-05, FR-AG-06, FR-AG-05, FR-NT-01, FR-NT-02.
 */
test("GP1 incident from portal to closed", async ({ browser }) => {
  const client = await newSession(browser, USERS.clientUser);
  await client.goto("/portal/new");
  await client.getByTestId("type-incident").click();
  await client.getByTestId("subject").fill("GP1 Warehouse scanner app crashes on sync");
  await client.getByTestId("description").fill("Since this morning the scanner app closes when we press Sync.\n\nSteps: open app → Sync. Two devices affected.");
  await client.getByLabel("high", { exact: false }).first().check();
  await client.getByTestId("send-request").click();
  const confirmation = client.getByTestId("request-confirmation");
  await expect(confirmation).toBeVisible();
  const key = (await confirmation.locator("h1").textContent())!.trim();
  expect(key).toMatch(/^EXP-\d+$/);
  await expect(confirmation).toContainText("aim to respond by");

  // Confirmation email with key and first-response target
  // emails are queued in-transaction and sent by the notify-flush job (pg_cron in production)
  const res = await client.request.get(`/api/cron/notify-flush`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  expect(res.ok()).toBeTruthy();
  const mail = await lastEmailTo(USERS.clientUser, "ticket_created", key);
  expect(mail.subject).toContain(key);

  // Portal shows "Received" with a target response date
  await client.goto(`/portal/tickets/${key}`);
  await expect(client.getByText("Received").first()).toBeVisible();
  await expect(client.getByText("Target response by")).toBeVisible();

  // Agent takes it (→ in progress, first response clock stops)
  const agent = await newSession(browser, USERS.agent);
  await agent.goto(`/app/tickets/${key}`);
  await expect(agent.getByTestId("ticket-subject")).toContainText("GP1");
  await expect(agent.getByText("P2 High").first()).toBeVisible(); // urgency high × impact medium (default)
  await agent.getByTestId("take").click();
  await expect(agent.getByText("In progress").first()).toBeVisible();
  await expect(agent.getByTestId("sla-first_response")).toContainText("met");

  // Agent asks the client a question → pending client
  await agent.getByTestId("status-menu").click();
  await agent.getByTestId("action-ask_client").click();
  await agent.getByLabel("Your question to the client").fill("Which Android version are the two devices on?");
  await agent.getByTestId("sheet-confirm").click();
  await expect(agent.getByText("Pending client").first()).toBeVisible();
  await expect(agent.getByTestId("sla-resolution")).toContainText("paused");

  // Client sees "Waiting for you", replies → back to in progress
  await client.goto("/portal");
  await expect(client.getByText("Waiting for you — reply to continue")).toBeVisible();
  await client.goto(`/portal/tickets/${key}`);
  await expect(client.getByText("Which Android version")).toBeVisible();
  await client.getByTestId("portal-reply").fill("Both are on Android 14, build UP1A.");
  await client.getByTestId("portal-send").click();
  await expect(client.getByText("Both are on Android 14")).toBeVisible();
  await expect(client.getByText("Being worked on").first()).toBeVisible();

  // Agent resolves with code + note
  await agent.reload();
  await expect(agent.getByText("Both are on Android 14")).toBeVisible();
  await agent.getByTestId("status-menu").click();
  await agent.getByTestId("action-resolve").click();
  await agent.getByLabel("Resolution note (visible to client)").fill("We shipped 2.4.1 which fixes the sync crash on Android 14. Please update from the store.");
  await agent.getByTestId("sheet-confirm").click();
  await expect(agent.getByText("Resolved").first()).toBeVisible();

  // Client confirms → closed
  await client.goto(`/portal/tickets/${key}`);
  await expect(client.getByText("Resolved — does this fix it for you?")).toBeVisible();
  await client.getByTestId("confirm-close").click();
  await expect(client.getByText("This request is closed.")).toBeVisible();
  await expect(client.getByTestId("follow-up")).toBeVisible();

  // Notifications: client got the resolved email; agent got the client-reply notification
  await client.request.get(`/api/cron/notify-flush`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}` } });
  const resolvedMail = await lastEmailTo(USERS.clientUser, "status_resolved", key);
  expect(resolvedMail.subject).toContain(key);
  const replyMail = await lastEmailTo(USERS.agent, "client_reply", key);
  expect(replyMail.subject).toContain(key);

  // Agent's view: both SLA metrics met, ticket closed
  await agent.reload();
  await expect(agent.getByText("Closed").first()).toBeVisible();
  await expect(agent.getByTestId("sla-resolution")).toContainText("met");
  await client.context().close();
  await agent.context().close();
});

test("login page rejects a wrong password with a uniform message", async ({ page }) => {
  await page.goto("/login");
  await page.locator('input[type="email"]').first().fill(USERS.agent);
  await page.locator('input[type="password"]').first().fill("definitely-wrong-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("form-error")).toContainText("Email or password is incorrect");
  await page.locator('input[type="email"]').first().fill("nobody@example.invalid");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByTestId("form-error")).toContainText("Email or password is incorrect");
  // still helper-signature use
  await login(page, USERS.agent);
  await expect(page).toHaveURL(/\/app/);
});

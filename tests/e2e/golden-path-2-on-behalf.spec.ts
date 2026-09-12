import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";

/**
 * Golden path 2: agent creates a ticket on behalf of a client, assigns to a colleague, colleague adds an
 * internal note + public reply; the client sees only the public reply. (FR-AG-07, FR-AG-04, FR-AG-06)
 */
test("GP2 on-behalf ticket; internal notes never reach the client", async ({ browser }) => {
  const agent = await newSession(browser, USERS.agent);
  await agent.goto("/app/tickets/new");
  await agent.getByLabel("Client").selectOption({ label: "Ceylon Agro Holdings (Pvt) Ltd" });
  await agent.getByLabel("Contact").selectOption({ index: 1 });
  const contactLabel = await agent.getByLabel("Contact").locator("option:checked").textContent();
  await agent.getByLabel("Type").selectOption("service_request");
  await agent.getByLabel("Subject").fill("GP2 Create depot supervisor accounts (phone request)");
  await agent.getByLabel("Description").fill("Sanduni called: three new supervisors start Monday — needs accounts with the depot role.");
  await agent.getByLabel("Impact").selectOption("low");
  await agent.getByLabel("Urgency").selectOption("medium");
  const assignOptions = await agent.getByLabel("Assign to").locator("option").allTextContents();
  await agent.getByLabel("Assign to").selectOption({ label: assignOptions.find((o) => o.includes("Tharushi Silva"))! });
  await agent.getByRole("button", { name: "Create ticket" }).click();
  await agent.waitForURL(/\/app\/tickets\/EXP-\d+/);
  const key = agent.url().split("/").pop()!;
  await expect(agent.getByText("P4 Low").first()).toBeVisible();
  await expect(agent.getByText("Tharushi Silva").first()).toBeVisible();
  await expect(agent.getByText("In progress").first()).toBeVisible();

  // Colleague: internal note + public reply
  const colleague = await newSession(browser, USERS.agent2);
  await colleague.goto(`/app/tickets/${key}`);
  await colleague.getByRole("tab", { name: "Internal note" }).click();
  await colleague.getByTestId("composer").fill("INTERNAL-ONLY: check with HR whether the third supervisor is a contractor.");
  await colleague.getByTestId("composer-send").click();
  await expect(colleague.getByText("Internal note added")).toBeVisible();
  await colleague.getByRole("tab", { name: "Reply to client" }).click();
  await colleague.getByTestId("composer").fill("Hi — accounts are being set up now; you'll have the details before Monday.");
  await colleague.getByTestId("composer-send").click();
  await expect(colleague.getByText("Reply sent to the client")).toBeVisible();
  await expect(colleague.getByText("INTERNAL-ONLY")).toBeVisible();

  // Client (the requester or org admin) sees only the public reply
  const client = await newSession(browser, USERS.clientAdmin);
  await client.goto(`/portal/tickets/${key}`);
  await expect(client.getByTestId("portal-subject")).toContainText("GP2");
  await expect(client.getByText("accounts are being set up now")).toBeVisible();
  const html = await client.content();
  expect(html).not.toContain("INTERNAL-ONLY");
  expect(html).not.toContain("Internal note");
  expect(contactLabel).toBeTruthy();
  await agent.context().close();
  await colleague.context().close();
  await client.context().close();
});

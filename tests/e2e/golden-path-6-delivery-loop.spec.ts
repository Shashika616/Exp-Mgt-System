import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";
import { adminSql } from "./helpers/db";

/**
 * Golden path 6 - the full support delivery loop (requirements §5.4, FR-DEV-01..07):
 * client raises a bug → admin triages + assigns to a developer → developer logs two work entries (timer + manual),
 * sets fix_in_progress, asks the client directly in-thread (client sees it, replies) → developer submits for review
 * → admin returns once with notes → developer updates and resubmits → admin approves (edits the reply) → ticket resolves,
 * client gets the reply and confirms. Time total, events and both dashboards reflect each step; the client never
 * sees work logs, the submission or internal notes.
 */
test("GP6 admin → developer → review → client", async ({ browser }) => {
  const client = await newSession(browser, USERS.clientUser);
  await client.goto("/portal/new");
  await client.getByTestId("type-incident").click();
  await client.getByTestId("subject").fill("GP6 Invoice PDF export fails for LKR amounts > 1M");
  await client.getByTestId("description").fill("Exporting invoice INV-2201 (LKR 1,250,000) shows a spinner then 'Something went wrong'. Smaller invoices export fine.");
  await client.getByTestId("send-request").click();
  const key = (await client.getByTestId("request-confirmation").locator("h1").textContent())!.trim();

  // Admin triages (impact high → P2) and assigns to Kasun (developer) → in progress, work_state investigating
  const admin = await newSession(browser, USERS.admin);
  await admin.goto(`/app/tickets/${key}`);
  await admin.getByLabel("Impact").selectOption("high");
  await expect(admin.getByText("P2 High").first()).toBeVisible();
  await admin.getByTestId("assignee-picker").click();
  await admin.getByRole("menuitem", { name: /Kasun Bandara/ }).click();
  await expect(admin.getByText("In progress").first()).toBeVisible();
  await expect(admin.getByText("Investigating").first()).toBeVisible();

  // Developer: dashboard shows it; timer + manual work log; work state → fix in progress
  const dev = await newSession(browser, USERS.dev);
  await dev.goto("/app");
  await expect(dev.getByText("GP6 Invoice PDF export").first()).toBeVisible();
  await dev.goto(`/app/tickets/${key}`);
  await dev.getByTestId("timer-start").click();
  await expect(dev.getByText("Timer started")).toBeVisible();
  await expect(dev.getByLabel(/Timer running on/)).toBeVisible(); // top-bar indicator
  await dev.getByTestId("timer-stop").click();
  await dev.getByTestId("worklog-minutes").fill("45");
  await dev.getByTestId("worklog-note").fill("Reproduced with a 1,250,000.00 amount: Intl.NumberFormat en-LK throws in the PDF renderer.");
  await dev.getByTestId("worklog-save").click();
  await expect(dev.getByTestId("time-total")).toHaveText("45m");
  await dev.getByTestId("log-work").click();
  await dev.getByTestId("worklog-minutes").fill("90");
  await dev.getByTestId("worklog-note").fill("Replaced the formatter with a locale-safe implementation; regression tests added.");
  await dev.getByTestId("worklog-state").selectOption("fix_in_progress");
  await dev.getByTestId("worklog-save").click();
  await expect(dev.getByTestId("time-total")).toHaveText("2h 15m");
  await expect(dev.getByText("Fix in progress").first()).toBeVisible();

  // Developer asks the client directly in the thread (public reply, shows as Engineer)
  await dev.getByTestId("composer").fill("Hi Priyantha, could you confirm the invoice date format you use (DD/MM/YYYY)? I want to verify the fix against your data.");
  await dev.getByTestId("composer-send").click();
  await expect(dev.getByText("Reply sent to the client")).toBeVisible();

  await client.goto(`/portal/tickets/${key}`);
  await expect(client.getByText("could you confirm the invoice date format")).toBeVisible();
  await expect(client.getByText("Engineer, Expendables")).toBeVisible();
  await client.getByTestId("portal-reply").fill("Yes, DD/MM/YYYY everywhere.");
  await client.getByTestId("portal-send").click();
  await expect(client.getByText("Yes, DD/MM/YYYY everywhere.")).toBeVisible();
  // Client never sees work logs / submissions / internal artefacts
  let html = await client.content();
  for (const forbidden of ["Work log", "work_state", "in_review", "Submitted for review", "Internal note", "Reproduced with a 1,250,000"]) expect(html).not.toContain(forbidden);

  // Developer submits for review
  await dev.reload();
  await dev.getByTestId("submit-review").click();
  await dev.getByTestId("sub-findings").fill("Locale-specific grouping separator crashes the PDF layer above six figures.");
  await dev.getByTestId("sub-changes").fill("Swapped formatter; added tests for 1M+ and negatives. PR #412.");
  await dev.getByTestId("sub-verification").fill("Unit tests pass; exported INV-2201 on staging and compared totals.");
  await dev.getByTestId("sub-reply").fill("Hi Priyantha, the export bug for amounts above one million rupees is fixed and deployed. Please try INV-2201 again.");
  await dev.getByTestId("submit-review-confirm").click();
  await expect(dev.getByText("Submitted to admin for review")).toBeVisible();
  await expect(dev.getByText("In review").first()).toBeVisible();
  // Developer cannot resolve/close/cancel: no such actions offered
  await expect(dev.getByTestId("action-resolve")).toHaveCount(0);
  await expect(dev.getByTestId("action-cancel")).toHaveCount(0);

  // Client label stays "Being worked on"
  await client.reload();
  await expect(client.getByText("Being worked on").first()).toBeVisible();
  html = await client.content();
  expect(html).not.toContain("In review");

  // Admin: review queue → return with notes
  await admin.goto("/app/review");
  await admin.getByTestId(`review-${key}`).click();
  await admin.waitForURL(new RegExp(`/app/tickets/${key}`));
  await expect(admin.getByRole("dialog", { name: `Review ${key}` })).toBeVisible();
  await admin.getByTestId("review-return-mode").click();
  await admin.getByTestId("review-notes").fill("Please add the negative-amount case to the tests and confirm the April export too.");
  await admin.getByTestId("review-return-confirm").click();
  await expect(admin.getByText("Returned to the developer with notes")).toBeVisible();
  await expect(admin.getByText("In progress").first()).toBeVisible();

  // Developer sees "Returned from review" on the dashboard, updates and resubmits
  await dev.goto("/app");
  await expect(dev.getByText("Returned from review").first()).toBeVisible();
  await dev.goto(`/app/tickets/${key}`);
  await expect(dev.getByText("Please add the negative-amount case").filter({ visible: true }).first()).toBeVisible();
  await dev.getByTestId("log-work").click();
  await dev.getByTestId("worklog-minutes").fill("30");
  await dev.getByTestId("worklog-note").fill("Added negative-amount test; April export verified.");
  await dev.getByTestId("worklog-save").click();
  await expect(dev.getByTestId("time-total")).toHaveText("2h 45m");
  await dev.getByTestId("submit-review").click();
  await dev.getByTestId("sub-findings").fill("Same as before; negative amounts now covered.");
  await dev.getByTestId("sub-changes").fill("Added negative-amount regression test. PR #412 updated.");
  await dev.getByTestId("sub-verification").fill("March + April exports verified on staging.");
  await dev.getByTestId("sub-reply").fill("Hi Priyantha, the export bug for amounts above one million rupees is fixed and deployed. Please try INV-2201 again.");
  await dev.getByTestId("submit-review-confirm").click();
  await expect(dev.getByText("Submitted to admin for review")).toBeVisible();

  // Admin approves with an edited reply → resolved; client receives the reply and confirms
  await admin.goto(`/app/tickets/${key}?review=1`);
  await admin.getByTestId("review-reply").fill("Hi Priyantha, amounts above one million rupees were hitting a formatting bug in the PDF export. It's fixed and deployed, please re-run INV-2201 and confirm it matches your ledger.");
  await admin.getByTestId("review-approve").click();
  await expect(admin.getByText(`${key} resolved: reply sent to the client`)).toBeVisible();
  await expect(admin.getByText("Resolved").first()).toBeVisible();

  await client.goto(`/portal/tickets/${key}`);
  await expect(client.getByText("please re-run INV-2201").first()).toBeVisible();
  await client.getByTestId("confirm-close").click();
  await expect(client.getByText("This request is closed.")).toBeVisible();

  // Events + totals + dashboards
  const sql = adminSql();
  const kinds = (await sql<{ kind: string }[]>`select e.kind from ticket_events e join tickets t on t.id = e.ticket_id where t.key = ${key} order by e.id`).map((r) => r.kind);
  for (const k of ["assigned", "work_logged", "work_state_changed", "submitted", "review_returned", "review_approved"]) expect(kinds).toContain(k);
  const [t] = await sql<{ time_spent_minutes: number; status: string; resolution_code: string }[]>`select time_spent_minutes, status, resolution_code from tickets where key = ${key}`;
  expect(t!.time_spent_minutes).toBe(165);
  expect(t!.status).toBe("closed");
  const subs = await sql<{ outcome: string; time_minutes: number }[]>`select outcome, time_minutes from submissions s join tickets t on t.id = s.ticket_id where t.key = ${key} order by s.submitted_at`;
  expect(subs.map((s) => s.outcome)).toEqual(["returned", "approved"]);
  await sql.end();
  await admin.goto("/app");
  await expect(admin.getByText("Load board")).toBeVisible();
  await expect(admin.getByText("Kasun Bandara").first()).toBeVisible();
  await client.context().close();
  await admin.context().close();
  await dev.context().close();
});

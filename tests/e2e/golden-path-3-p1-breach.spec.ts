import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";
import { adminSql, runJobsNow } from "./helpers/db";
import { lastEmailTo } from "./helpers/outbox";

/**
 * Golden path 3: P1 incident (urgency high × impact high) → no response → at-risk at 22.5 min → breached at 30
 * → escalated → lead notified → resolved with overtime recorded. Time is advanced by shifting the timer's
 * started_at, then running the sla.tick job exactly as pg_cron would. (FR-NT-02, requirements §6)
 */
test("GP3 P1 breach, escalation and overtime", async ({ browser, baseURL }) => {
  const agent = await newSession(browser, USERS.agent);
  await agent.goto("/app/tickets/new");
  await agent.getByLabel("Client").selectOption({ label: "Kandy Textile Mills" }); // standard tier: P1 first response 30 min
  await agent.getByLabel("Contact").selectOption({ index: 0 });
  await agent.getByLabel("Type").selectOption("incident");
  await agent.getByLabel("Subject").fill("GP3 Core banking API down for all branches");
  await agent.getByLabel("Description").fill("All branch terminals get HTTP 503 from the core API since 09:10. Production down.");
  await agent.getByLabel("Impact").selectOption("high");
  await agent.getByLabel("Urgency").selectOption("high");
  await expect(agent.getByText("P1 Critical")).toBeVisible();
  await agent.getByRole("button", { name: "Create ticket" }).click();
  await agent.waitForURL(/\/app\/tickets\/EXP-\d+/);
  const key = agent.url().split("/").pop()!;

  const sql = adminSql();
  const shift = (minutes: number) => sql`update sla_timers set started_at = now() - (${minutes} || ' minutes')::interval, due_at = now() - (${minutes} || ' minutes')::interval + (target_minutes || ' minutes')::interval from tickets t where t.id = sla_timers.ticket_id and t.key = ${key}`;

  // 23 minutes without a response → at risk (75 % of 30)
  await shift(23);
  const r1 = (await runJobsNow(baseURL!)) as { sla: { atRisk: number } };
  expect(r1.sla.atRisk).toBeGreaterThanOrEqual(1);
  await agent.reload();
  await expect(agent.getByText("At risk").first()).toBeVisible();
  const atRiskMail = await lastEmailTo(USERS.lead, "sla_at_risk", key);
  expect(atRiskMail.subject).toContain(key);

  // 31 minutes → breached → escalation level 1, lead + admin notified
  await shift(31);
  const r2 = (await runJobsNow(baseURL!)) as { sla: { breached: number } };
  expect(r2.sla.breached).toBeGreaterThanOrEqual(1);
  await agent.reload();
  await expect(agent.getByText("Breached").first()).toBeVisible();
  await expect(agent.getByText("Escalated L1")).toBeVisible();
  const breachMail = await lastEmailTo(USERS.lead, "sla_breached", key);
  expect(breachMail.subject).toContain("breached");
  const [esc] = await sql<{ level: number }[]>`select escalation_level as level from tickets where key = ${key}`;
  expect(esc!.level).toBe(1);

  // Lead sees it on the dashboard escalations + resolves; overtime recorded on the first-response timer
  const lead = await newSession(browser, USERS.lead);
  await lead.goto("/app");
  await expect(lead.getByText("Recent escalations")).toBeVisible();
  await expect(lead.getByText(key).first()).toBeVisible();
  await lead.goto(`/app/tickets/${key}`);
  await lead.getByTestId("take").click();
  await lead.getByTestId("status-menu").click();
  await lead.getByTestId("action-resolve").click();
  await lead.getByLabel("Resolution note (visible to client)").fill("Failover to the standby API node completed; all branches are back online.");
  await lead.getByTestId("sheet-confirm").click();
  await expect(lead.getByText("Resolved").first()).toBeVisible();
  const [fr] = await sql<{ met_at: Date | null; breached_at: Date | null; elapsed_ms: string }[]>`select met_at, breached_at, elapsed_ms from sla_timers s join tickets t on t.id = s.ticket_id where t.key = ${key} and s.metric = 'first_response'`;
  expect(fr!.met_at).not.toBeNull();
  expect(fr!.breached_at).not.toBeNull();
  expect(Number(fr!.elapsed_ms)).toBeGreaterThan(30 * 60_000); // overtime kept for reporting
  await expect(lead.getByTestId("sla-first_response")).toContainText("met late");
  await sql.end();
  await agent.context().close();
  await lead.context().close();
});

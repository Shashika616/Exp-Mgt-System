import { expect, test } from "./helpers/fixtures";
import { newSession } from "./helpers/auth";
import { adminSql } from "./helpers/db";

/**
 * security.md §6 snapshot test: a client-role response never contains internal comments, work_logs,
 * submissions, work_state or in_review — checked on a ticket that has ALL of them.
 */
test("client ticket page contains none of the staff-only artefacts", async ({ browser }) => {
  const sql = adminSql();
  const [t] = await sql<{ key: string; note: string; body: string; findings: string; email: string }[]>`
    select t.key, w.note, c.body, s.findings, u.email
    from tickets t
    join work_logs w on w.ticket_id = t.id
    join comments c on c.ticket_id = t.id and c.visibility = 'internal'
    join submissions s on s.ticket_id = t.id
    join users u on u.org_id = t.org_id and u.role_id = 'client_admin' and u.status = 'active'
    where t.status = 'in_review'
    limit 1`;
  expect(t, "seed should provide a ticket in review with logs, internal note and submission").toBeTruthy();
  const page = await newSession(browser, t!.email);
  const res = await page.goto(`/portal/tickets/${t!.key}`);
  expect(res!.status()).toBe(200);
  const html = await page.content();
  for (const s of [t!.note, t!.body, t!.findings, "in_review", "In review", "work_state", "Work log", "Submitted for review", "Internal note", "fix_ready", "Fix ready"]) {
    expect(html, `client HTML must not contain "${s.slice(0, 40)}"`).not.toContain(s);
  }
  await expect(page.getByText("Being worked on").first()).toBeVisible();
  // and the portal list JSON-ish payload (RSC) — the same rule applies to the list page
  const list = await page.goto("/portal?scope=all");
  expect(list!.status()).toBe(200);
  const listHtml = await page.content();
  expect(listHtml).not.toContain("in_review");
  expect(listHtml).not.toContain("work_state");
  await sql.end();
  await page.context().close();
});

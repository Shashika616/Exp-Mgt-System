import { expect, test } from "./helpers/fixtures";
import { USERS, newSession } from "./helpers/auth";
import { adminSql } from "./helpers/db";

/** security.md A01 — cross-tenant access returns 404 (not 403) and logs access_denied; developers only see assigned. */
test.describe("IDOR & role scope", () => {
  test("client cannot read another org's ticket, attachment or contacts", async ({ browser }) => {
    const sql = adminSql();
    const [other] = await sql<{ key: string; id: string; org_id: string }[]>`select t.key, t.id, t.org_id from tickets t join organisations o on o.id = t.org_id where o.slug = 'serendib-freight' limit 1`;
    const page = await newSession(browser, USERS.clientAdmin);
    expect((await page.goto(`/portal/tickets/${other!.key}`))!.status()).toBe(404);
    const contacts = await page.request.get(`/api/orgs/${other!.org_id}/contacts`);
    expect(contacts.status()).toBe(404);
    const version = await page.request.get(`/api/tickets/${other!.id}/version`);
    expect(version.status()).toBe(404);
    const [d] = await sql<{ n: number }[]>`select count(*)::int as n from audit_log where action = 'access_denied' and actor_email = ${USERS.clientAdmin}`;
    expect(d!.n).toBeGreaterThanOrEqual(1);
    await sql.end();
    await page.context().close();
  });

  test("client cannot open the staff app; staff cannot open the portal", async ({ browser }) => {
    const client = await newSession(browser, USERS.clientUser);
    await client.goto("/app/tickets");
    await expect(client).toHaveURL(/\/portal/);
    const agent = await newSession(browser, USERS.agent);
    await agent.goto("/portal");
    await expect(agent).toHaveURL(/\/app/);
    await client.context().close();
    await agent.context().close();
  });

  test("developer sees only assigned tickets (404 otherwise) and has no admin actions", async ({ browser }) => {
    const sql = adminSql();
    const [foreign] = await sql<{ key: string }[]>`select t.key from tickets t join users u on u.id = t.assignee_id where u.email = ${USERS.dev2} limit 1`;
    const [mine] = await sql<{ key: string }[]>`select t.key from tickets t join users u on u.id = t.assignee_id where u.email = ${USERS.dev} and t.status = 'in_progress' limit 1`;
    const dev = await newSession(browser, USERS.dev);
    expect((await dev.goto(`/app/tickets/${foreign!.key}`))!.status()).toBe(404);
    await dev.goto(`/app/tickets/${mine!.key}`);
    await expect(dev.getByTestId("ticket-subject")).toBeVisible();
    await expect(dev.getByTestId("take")).toHaveCount(0);
    await expect(dev.getByTestId("assignee-picker")).toHaveCount(0);
    await dev.getByTestId("status-menu").click();
    await expect(dev.getByTestId("action-resolve")).toHaveCount(0);
    await expect(dev.getByTestId("action-cancel")).toHaveCount(0);
    await expect(dev.getByTestId("action-hold")).toBeVisible();
    await dev.goto("/app/admin/users");
    await expect(dev).not.toHaveURL(/\/app\/admin/);
    await sql.end();
    await dev.context().close();
  });

  test("anonymous requests are redirected and APIs return 401", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/portal/tickets/EXP-1001");
    await expect(page).toHaveURL(/\/login/);
    expect((await page.request.get("/api/orgs/00000000-0000-0000-0000-000000000000/contacts")).status()).toBe(401);
    expect((await page.request.get("/api/cron/sla-tick")).status()).toBe(401);
    expect((await page.request.get("/api/attachments/00000000-0000-0000-0000-000000000000/download")).status()).toBe(401);
  });

  test("security headers and CSP are present", async ({ page }) => {
    const res = await page.goto("/login");
    const h = res!.headers();
    expect(h["content-security-policy"]).toContain("frame-ancestors 'none'");
    expect(h["content-security-policy"]).toMatch(/script-src 'self' 'nonce-/);
    expect(h["x-content-type-options"]).toBe("nosniff");
    expect(h["x-frame-options"]).toBe("DENY");
    expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(h["strict-transport-security"]).toContain("max-age=63072000");
  });
});

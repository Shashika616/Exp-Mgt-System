// Realistic demo data (design.md §12 item 1): 6 client orgs, 3 developers, 2 agents, 1 admin, ~150 tickets
// across every status / priority / SLA state / work_state, with work logs, submissions, comments and events.
// Deterministic (seeded PRNG) so e2e tests can rely on it. DEV/TEST ONLY.
import { eq, sql } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "@/db/schema";
import { computePriority } from "@/lib/domain/priority";
import { DEFAULT_CALENDAR } from "@/lib/domain/sla-calendar";
import { DEFAULT_SLA_TARGETS, newTimer, pause, stop, tick, type TimerRow } from "@/lib/domain/sla-timers";
import type { HoldReason, Level3, ResolutionCode, TicketStatus, TicketType, WorkState } from "@/lib/domain/types";
import { renderMarkdown } from "@/lib/markdown";

type Db = PostgresJsDatabase<typeof schema>;

export const DEMO_PASSWORD = "Expendables#2026!";
/** Fixed TOTP secret for the demo admin/lead so tests can compute codes (base32). */
export const DEMO_TOTP_SECRET = "JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP";

export const DEMO_USERS = {
  admin: { email: "admin@expendables.lk", fullName: "Dilshan Jayasuriya", role: "admin" as const },
  lead: { email: "lead@expendables.lk", fullName: "Anjali Ratnayake", role: "lead" as const },
  agent1: { email: "nimal@expendables.lk", fullName: "Nimal Perera", role: "agent" as const },
  agent2: { email: "tharushi@expendables.lk", fullName: "Tharushi Silva", role: "agent" as const },
  dev1: { email: "kasun@expendables.lk", fullName: "Kasun Bandara", role: "developer" as const },
  dev2: { email: "ishara@expendables.lk", fullName: "Ishara Wickramasinghe", role: "developer" as const },
  dev3: { email: "ravindu@expendables.lk", fullName: "Ravindu Gunasekara", role: "developer" as const },
};

export const DEMO_ORGS = [
  { name: "Ceylon Agro Holdings (Pvt) Ltd", slug: "ceylon-agro", tier: "enterprise" as const, contacts: [["Sanduni Wijeratne", "sanduni@ceylonagro.example", "client_admin"], ["Priyantha Kumara", "priyantha@ceylonagro.example", "client_user"], ["Malith Fonseka", "malith@ceylonagro.example", "client_user"]] },
  { name: "Serendib Freight & Logistics", slug: "serendib-freight", tier: "priority" as const, contacts: [["Roshan de Silva", "roshan@serendibfreight.example", "client_admin"], ["Nadeesha Herath", "nadeesha@serendibfreight.example", "client_user"]] },
  { name: "Ruhunu Microfinance PLC", slug: "ruhunu-mf", tier: "enterprise" as const, contacts: [["Chamari Abeysekera", "chamari@ruhunumf.example", "client_admin"], ["Lasith Jayawardena", "lasith@ruhunumf.example", "client_user"], ["Dinusha Peiris", "dinusha@ruhunumf.example", "client_user"]] },
  { name: "Kandy Textile Mills", slug: "kandy-textile", tier: "standard" as const, contacts: [["Harsha Ekanayake", "harsha@kandytextile.example", "client_admin"], ["Sachini Rajapaksa", "sachini@kandytextile.example", "client_user"]] },
  { name: "Island Health Network", slug: "island-health", tier: "priority" as const, contacts: [["Dr. Menaka Senanayake", "menaka@islandhealth.example", "client_admin"], ["Kavinda Liyanage", "kavinda@islandhealth.example", "client_user"]] },
  { name: "Colombo Property Group", slug: "colombo-property", tier: "standard" as const, contacts: [["Amila Dissanayake", "amila@colomboproperty.example", "client_admin"], ["Thilini Gamage", "thilini@colomboproperty.example", "client_user"]] },
] as const;

const SUBJECTS: Record<TicketType, string[]> = {
  incident: [
    "Invoice PDF export fails for LKR amounts > 1M",
    "Warehouse scanner app crashes on Android 14 after update",
    "Payroll run stuck at 'Calculating EPF' since 06:10",
    "SMS OTP not delivered to Dialog numbers",
    "Dashboard shows yesterday's stock levels",
    "500 error when approving purchase orders above 50 items",
    "Customer portal login loops back to sign-in page",
    "Nightly backup job failed — disk quota exceeded",
    "Loan repayment schedule off by one day after month end",
    "Fleet tracking map blank in Safari 17",
    "Duplicate patient records created on quick registration",
    "Email notifications delayed by ~2 hours",
    "GRN posting rejects batches with expiry in 2027",
    "Tenant statement totals differ from ledger",
    "Timesheet approval button unresponsive on mobile",
  ],
  service_request: [
    "Create accounts for 3 new depot supervisors",
    "Export all Q2 invoices to CSV for the auditors",
    "Reset MFA for finance manager (new phone)",
    "Add Matara branch to the branch list",
    "Increase upload limit for lab reports to 50 MB",
    "Provision a UAT environment for the mobile team",
    "Rotate SFTP credentials for the bank feed",
    "Grant read-only reporting access to the CFO",
  ],
  change_request: [
    "Add VAT breakdown to customer-facing invoices",
    "Allow partial deliveries against a single PO",
    "Support NIC v2 format in KYC form",
    "Bulk SMS reminders for overdue instalments",
    "Two-step approval for tenant refunds",
    "Show ward occupancy on the admissions dashboard",
    "Configurable working days per branch for SLA reports",
  ],
  question: [
    "How do we archive closed job cards older than 3 years?",
    "Which browsers are officially supported for the HR portal?",
    "Can the reconciliation report be scheduled weekly?",
    "Where is the audit trail for price list changes?",
    "Is there an API to pull daily collections?",
  ],
  project_enquiry: ["Mobile app for field agents — scoping call", "Migrate legacy FoxPro inventory to the web ERP", "Data warehouse and BI dashboards — proposal", "Patient self-check-in kiosk pilot"],
};

const DESCRIPTIONS = [
  "**Steps to reproduce**\n\n1. Open the module\n2. Use the filter for last month\n3. Click export\n\n**Expected:** file downloads.\n**Actual:** spinner for ~30 s then \"Something went wrong\".\n\nAffects the whole finance team — month-end close is on Friday.",
  "Started after this morning's release. Two users on the Kandy site confirmed, one in Colombo could not reproduce. Screenshots attached in the thread.",
  "This is needed before the audit visit on the 25th. Happy to jump on a call if it helps — I'm free most afternoons.",
  "Not urgent but it is confusing our operators. The value shown in the summary card is correct in the detail view.",
  "Please treat as high priority: customers are calling the branch because the notification has not arrived.",
];

const DEV_NOTES = [
  "Reproduced locally with a 1,250,000.00 amount. `Intl.NumberFormat` with `en-LK` throws on the grouping separator in the PDF renderer.",
  "Traced to the nightly job holding a lock on `stock_snapshot`. Added `SKIP LOCKED` and a smaller batch size.",
  "Vendor SDK returns 503 for numbers on the 077 prefix; retry with backoff is in place, waiting on vendor ticket #4471.",
  "Patched the date maths to use the org timezone rather than UTC. Added regression tests for month-end boundaries.",
  "Session cookie was being set with `SameSite=Strict`, breaking the SSO redirect. Switched to `Lax`.",
  "Needs the client's confirmation of the expected rounding rule before I change the ledger posting.",
];

const CLIENT_REPLIES = ["Thanks — tried again and it works for the March file but not April.", "Screenshot attached. It happens on Chrome and Edge.", "Confirmed fixed on our side, thank you!", "Can this wait until after month end? We'd rather not deploy mid-close.", "Yes please go ahead with the change."];
const STAFF_REPLIES = ["Thanks for the report — we've reproduced it and Kasun is on it. We'll update you here.", "Could you tell us which browser and version you're using, and whether it happens for other users too?", "We've deployed a fix to production. Please try again and let us know.", "We're waiting on the SMS vendor; we'll keep you posted here.", "This is scheduled for the release on Thursday evening."];

// Deterministic PRNG (mulberry32)
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedDemo(db: Db, opts: { staffOrgId: string; policyId: string; hashPassword: (p: string) => Promise<string>; encrypt: (s: string) => string; sha256: (s: string) => string }) {
  await db.execute(sql`select set_config('app.role','system',true)`);
  const rand = rng(20260912);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
  const chance = (p: number) => rand() < p;
  const now = new Date();
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
  const passwordHash = await opts.hashPassword(DEMO_PASSWORD);

  // --- staff users
  const staff: Record<keyof typeof DEMO_USERS, string> = {} as never;
  for (const [k, u] of Object.entries(DEMO_USERS) as [keyof typeof DEMO_USERS, (typeof DEMO_USERS)[keyof typeof DEMO_USERS]][]) {
    const [row] = await db
      .insert(schema.users)
      .values({ email: u.email, fullName: u.fullName, roleId: u.role, orgId: opts.staffOrgId, status: "active", mfaEnrolled: u.role === "admin" || u.role === "lead" })
      .onConflictDoUpdate({ target: schema.users.email, set: { fullName: u.fullName, status: "active" } })
      .returning({ id: schema.users.id });
    staff[k] = row!.id;
    await db.update(schema.users).set({ authProviderId: row!.id }).where(eq(schema.users.id, row!.id));
    await db
      .insert(schema.localCredentials)
      .values({ userId: row!.id, passwordHash, totpSecretEnc: u.role === "admin" || u.role === "lead" ? opts.encrypt(DEMO_TOTP_SECRET) : null, recoveryCodeHashes: u.role === "admin" ? [opts.sha256("recovery-code-1"), opts.sha256("recovery-code-2")] : [] })
      .onConflictDoUpdate({ target: schema.localCredentials.userId, set: { passwordHash } });
  }
  const developers = [staff.dev1, staff.dev2, staff.dev3];
  const agents = [staff.agent1, staff.agent2];

  // --- client orgs + contacts
  const [enterprisePolicy] = await db.select({ id: schema.slaPolicies.id }).from(schema.slaPolicies).where(eq(schema.slaPolicies.name, "Enterprise 24×7")).limit(1);
  const orgs: { id: string; name: string; contacts: { id: string; name: string; role: string }[]; tz: string }[] = [];
  for (const o of DEMO_ORGS) {
    const [org] = await db
      .insert(schema.organisations)
      .values({ type: "client", name: o.name, slug: o.slug, tier: o.tier, timezone: "Asia/Colombo", slaPolicyId: o.tier === "enterprise" ? (enterprisePolicy?.id ?? opts.policyId) : opts.policyId, notes: o.tier === "enterprise" ? "24×7 support contract. Escalation contact: CTO." : null })
      .onConflictDoUpdate({ target: schema.organisations.slug, set: { name: o.name } })
      .returning({ id: schema.organisations.id });
    await db.insert(schema.orgSettings).values({ orgId: org!.id, showTimeToClient: o.tier === "enterprise" }).onConflictDoNothing();
    const contacts: { id: string; name: string; role: string }[] = [];
    for (const [name, email, role] of o.contacts) {
      const [u] = await db
        .insert(schema.users)
        .values({ email, fullName: name, roleId: role, orgId: org!.id, status: "active" })
        .onConflictDoUpdate({ target: schema.users.email, set: { fullName: name } })
        .returning({ id: schema.users.id });
      await db.update(schema.users).set({ authProviderId: u!.id }).where(eq(schema.users.id, u!.id));
      await db.insert(schema.localCredentials).values({ userId: u!.id, passwordHash }).onConflictDoUpdate({ target: schema.localCredentials.userId, set: { passwordHash } });
      contacts.push({ id: u!.id, name, role });
    }
    await db.update(schema.organisations).set({ primaryContactId: contacts[0]!.id }).where(eq(schema.organisations.id, org!.id));
    orgs.push({ id: org!.id, name: o.name, contacts, tz: "Asia/Colombo" });
  }

  const categories = await db.select({ id: schema.categories.id, name: schema.categories.name, parentId: schema.categories.parentId }).from(schema.categories);
  const parents = categories.filter((c) => !c.parentId);

  // Skip ticket generation when already seeded
  const [cnt] = await db.select({ n: sql<number>`count(*)::int` }).from(schema.tickets);
  if ((cnt?.n ?? 0) > 0) return { orgs, staff };

  const policyFor = (orgIdx: number) => (DEMO_ORGS[orgIdx]!.tier === "enterprise" ? { targets: { p1: { first_response_min: 15, resolution_min: 240, calendar: "24x7" as const }, p2: { first_response_min: 60, resolution_min: 720, calendar: "24x7" as const }, p3: { first_response_min: 240, resolution_min: 1440, calendar: "24x7" as const }, p4: { first_response_min: 480, resolution_min: 2880, calendar: "24x7" as const } } } : { targets: DEFAULT_SLA_TARGETS });

  // --- scenario plan: 150 tickets with a deliberate mix
  type Plan = { status: TicketStatus; ageMin: number; type: TicketType; urgency: Level3; impact: Level3; workState?: WorkState | null; hold?: HoldReason; dev?: boolean; returned?: boolean; escalate?: boolean };
  const plans: Plan[] = [];
  const statusMix: [TicketStatus, number][] = [["new", 12], ["open", 14], ["in_progress", 34], ["in_review", 9], ["pending_client", 16], ["on_hold", 8], ["resolved", 20], ["closed", 32], ["cancelled", 5]];
  for (const [status, count] of statusMix) {
    for (let i = 0; i < count; i++) {
      const type = pick<TicketType>(status === "in_review" || status === "in_progress" ? ["incident", "incident", "change_request", "service_request"] : ["incident", "incident", "service_request", "change_request", "question", "project_enquiry"]);
      const urgency = pick<Level3>(type === "question" || type === "project_enquiry" ? ["low"] : type === "incident" ? ["low", "medium", "high", "high"] : ["low", "medium"]);
      const impact = pick<Level3>(["low", "medium", "medium", "high"]);
      const terminal = status === "closed" || status === "cancelled" || status === "resolved";
      const ageMin = terminal ? 60 * 24 * (2 + Math.floor(rand() * 55)) : status === "new" ? 5 + Math.floor(rand() * 600) : 60 * (1 + Math.floor(rand() * 24 * 12));
      const dev = status === "in_review" || status === "on_hold" || (status === "in_progress" && chance(0.7)) || (status === "pending_client" && chance(0.5)) || (terminal && chance(0.6));
      const workState: WorkState | null = dev ? (status === "in_review" ? "fix_ready" : status === "on_hold" ? "blocked" : pick(["investigating", "fix_in_progress", "fix_in_progress", "fix_ready", "needs_info", "blocked"])) : null;
      plans.push({ status, ageMin, type, urgency, impact, workState: terminal ? null : workState, hold: status === "on_hold" ? pick(["awaiting_vendor", "awaiting_change_window", "awaiting_approval", "awaiting_third_party"]) : undefined, dev, returned: status === "in_progress" && dev && chance(0.25), escalate: status !== "closed" && status !== "cancelled" && chance(0.08) });
    }
  }
  // A few deliberate SLA states for dashboards (P1 at-risk, P1 breached & escalated, P2 breached)
  plans.push({ status: "new", ageMin: 24, type: "incident", urgency: "high", impact: "high" }); // at-risk (30 min target)
  plans.push({ status: "new", ageMin: 95, type: "incident", urgency: "high", impact: "high", escalate: true }); // breached
  plans.push({ status: "in_progress", ageMin: 60 * 30, type: "incident", urgency: "high", impact: "medium", dev: true, workState: "fix_in_progress", escalate: true }); // P2 resolution breached
  plans.push({ status: "pending_client", ageMin: 60 * 24 * 9, type: "incident", urgency: "medium", impact: "medium", dev: true, workState: "needs_info" }); // aging pending

  let created = 0;
  for (const plan of plans) {
    const orgIdx = Math.floor(rand() * orgs.length);
    const org = orgs[orgIdx]!;
    const requester = pick(org.contacts);
    const priority = computePriority(plan.impact, plan.urgency);
    const createdAt = minutesAgo(plan.ageMin);
    const agent = pick(agents);
    const developer = plan.dev ? pick(developers) : null;
    const assignee = developer ?? (plan.status === "new" ? null : plan.status === "open" && chance(0.5) ? null : agent);
    const subject = pick(SUBJECTS[plan.type]);
    const parent = pick(parents);
    const sub = categories.filter((c) => c.parentId === parent.id);
    const source = chance(0.8) ? "portal" : "agent";
    const resolutionCode: ResolutionCode | null = plan.status === "resolved" || plan.status === "closed" ? pick(["fixed", "fixed", "workaround", "configuration", "user_education", "not_reproducible"]) : plan.status === "cancelled" ? "cancelled_by_client" : null;
    const isTerminalOrResolved = plan.status === "resolved" || plan.status === "closed" || plan.status === "cancelled";
    const ageFraction = (f: number) => new Date(createdAt.getTime() + f * (now.getTime() - createdAt.getTime()));
    const targets = policyFor(orgIdx).targets[priority];
    const capAt = (d: Date, latest: Date) => (d > latest ? latest : d);
    const afterCreated = (min: number) => new Date(createdAt.getTime() + min * 60_000);
    // ~80 % of first responses inside target, a realistic tail late (wall-clock approximation of business hours)
    const firstRespondedAt = plan.status === "new" ? null : capAt(afterCreated(targets.first_response_min * (targets.calendar === "business" ? 2.5 : 1) * (0.15 + rand() * 1.1)), minutesAgo(1));
    const resTarget = targets.resolution_min ?? 480;
    const resolvedAt = plan.status === "resolved" || plan.status === "closed" ? capAt(afterCreated(Math.max(resTarget * (targets.calendar === "business" ? 3 : 1) * (0.3 + rand() * 1.0), (firstRespondedAt ? (firstRespondedAt.getTime() - createdAt.getTime()) / 60_000 : 0) + 30)), minutesAgo(60)) : null;
    const closedAt = plan.status === "closed" ? capAt(new Date(resolvedAt!.getTime() + (1 + rand() * 3) * 86_400_000), minutesAgo(5)) : plan.status === "cancelled" ? ageFraction(0.3) : null;
    const submittedAt = plan.status === "in_review" ? ageFraction(0.85) : null;

    const [t] = await db
      .insert(schema.tickets)
      .values({
        orgId: org.id,
        requesterId: requester.id,
        assigneeId: assignee,
        type: plan.type,
        subject,
        description: pick(DESCRIPTIONS),
        status: plan.status,
        holdReason: plan.hold ?? null,
        holdNote: plan.hold === "other" ? "See vendor thread" : null,
        urgency: plan.urgency,
        impact: plan.impact,
        priority,
        categoryId: plan.type === "project_enquiry" ? parents.find((p) => p.name === "New project")?.id ?? parent.id : parent.id,
        subcategoryId: sub.length && plan.type !== "project_enquiry" ? pick(sub).id : null,
        source,
        resolutionCode,
        resolutionNote: plan.status === "resolved" || plan.status === "closed" ? "We've deployed a fix and verified it against your data. Please confirm on your side." : null,
        cancelReason: plan.status === "cancelled" ? "No longer required" : null,
        escalationLevel: plan.escalate ? 1 : 0,
        escalatedAt: plan.escalate ? ageFraction(0.6) : null,
        workState: plan.workState ?? null,
        submittedAt,
        submittedBy: submittedAt ? developer : null,
        reviewedAt: plan.returned ? ageFraction(0.6) : null,
        reviewedBy: plan.returned ? staff.admin : null,
        reviewOutcome: plan.returned ? "returned" : null,
        firstRespondedAt,
        resolvedAt,
        closedAt,
        lastClientReplyAt: plan.status === "in_progress" && chance(0.4) ? ageFraction(0.8) : null,
        lastStaffReplyAt: firstRespondedAt,
        reopenedCount: plan.status !== "new" && chance(0.08) ? 1 : 0,
        createdBy: source === "agent" ? agent : requester.id,
        updatedBy: assignee ?? requester.id,
        createdAt,
        updatedAt: isTerminalOrResolved ? (closedAt ?? resolvedAt ?? createdAt) : ageFraction(0.9),
      })
      .returning({ id: schema.tickets.id, key: schema.tickets.key });
    const ticketId = t!.id;
    created++;

    // --- SLA timers via the domain functions
    const pol = policyFor(orgIdx);
    for (const metric of ["first_response", "resolution"] as const) {
      let timer: TimerRow | null = newTimer(metric, priority, plan.type, pol.targets, DEFAULT_CALENDAR, createdAt);
      if (!timer) continue;
      if (metric === "first_response" && firstRespondedAt) timer = stop(timer, firstRespondedAt, DEFAULT_CALENDAR);
      if (metric === "resolution") {
        if (resolvedAt) timer = stop(timer, resolvedAt, DEFAULT_CALENDAR);
        else if (plan.status === "cancelled") timer = stop(timer, closedAt!, DEFAULT_CALENDAR);
        else if (plan.status === "pending_client" || plan.status === "on_hold") timer = pause(timer, ageFraction(0.8), DEFAULT_CALENDAR);
      }
      timer = tick(timer, now, DEFAULT_CALENDAR).timer;
      await db.insert(schema.slaTimers).values({ ticketId, orgId: org.id, metric, calendar: timer.calendar, targetMinutes: timer.targetMinutes, startedAt: timer.startedAt, pausedAt: timer.pausedAt, elapsedMs: timer.elapsedMs, dueAt: timer.dueAt, atRiskNotified: timer.atRiskNotified, breachedAt: timer.breachedAt, metAt: timer.metAt });
    }

    // --- events + comments
    const ev = (kind: string, at: Date, actorId: string | null, data: Record<string, unknown> = {}, visibility: "public" | "internal" = "internal") =>
      db.insert(schema.ticketEvents).values({ ticketId, orgId: org.id, actorId, kind, data, visibility, createdAt: at });
    const comment = async (authorId: string, body: string, visibility: "public" | "internal", at: Date, kind = "comment") => {
      const [c] = await db.insert(schema.comments).values({ ticketId, orgId: org.id, authorId, visibility, body, bodyHtml: await renderMarkdown(body), kind, createdAt: at }).returning({ id: schema.comments.id });
      await ev("commented", at, authorId, { commentId: c!.id, visibility }, visibility);
    };
    await ev("created", createdAt, source === "agent" ? agent : requester.id, { source, type: plan.type, priority, key: t!.key }, "public");
    if (plan.status !== "new") {
      await ev("status_changed", ageFraction(0.05), agent, { action: "acknowledge", from: "new", to: "open" }, "public");
      if (assignee) await ev("assigned", ageFraction(0.08), staff.admin, { from: null, to: assignee, assigneeRole: developer ? "developer" : "agent" });
      if (firstRespondedAt) {
        await comment(developer ?? agent, pick(STAFF_REPLIES), "public", firstRespondedAt);
        await ev("first_response", firstRespondedAt, developer ?? agent, {});
      }
      if (plan.status !== "open") await ev("status_changed", ageFraction(0.1), agent, { action: "start", from: "open", to: "in_progress" }, "public");
    }
    if (chance(0.5) && plan.status !== "new") await comment(requester.id, pick(CLIENT_REPLIES), "public", ageFraction(0.3));
    if (chance(0.6) && plan.status !== "new") await comment(agent, `Internal: ${pick(DEV_NOTES)}`, "internal", ageFraction(0.35));

    // --- developer work logs & submissions
    if (developer && plan.status !== "new" && plan.status !== "open") {
      const entries = 1 + Math.floor(rand() * 3);
      let running = 0;
      for (let i = 0; i < entries; i++) {
        const at = ageFraction(0.2 + i * 0.15);
        const minutes = 15 * (1 + Math.floor(rand() * 12));
        const state: WorkState = i === 0 ? "investigating" : "fix_in_progress";
        const [wl] = await db.insert(schema.workLogs).values({ ticketId, orgId: org.id, userId: developer, loggedOn: at.toISOString().slice(0, 10), minutes, note: pick(DEV_NOTES), workState: state, createdAt: at, updatedAt: at, startedAt: i === 0 ? new Date(at.getTime() - minutes * 60_000) : null, endedAt: i === 0 ? at : null }).returning({ id: schema.workLogs.id });
        running += minutes;
        await ev("work_logged", at, developer, { workLogId: wl!.id, minutes, workState: state, total: running });
        await ev("work_state_changed", at, developer, { from: i === 0 ? null : "investigating", to: state });
      }
      if (plan.workState === "blocked" || plan.workState === "needs_info") await ev("work_state_changed", ageFraction(0.75), developer, { from: "fix_in_progress", to: plan.workState, note: "Waiting on the vendor / client for details." });
      const [tot] = await db.select({ m: schema.tickets.timeSpentMinutes }).from(schema.tickets).where(eq(schema.tickets.id, ticketId));
      const total = tot!.m;
      const makeSubmission = async (at: Date, outcome: "approved" | "returned" | null) => {
        const [s] = await db
          .insert(schema.submissions)
          .values({
            ticketId,
            orgId: org.id,
            developerId: developer,
            findings: pick(DEV_NOTES),
            rootCause: "Locale-specific number formatting in the PDF layer was never exercised by tests for amounts above six figures.",
            changesMade: "Replaced the formatter with a locale-safe implementation; added regression tests for 1M+ amounts and negative values.",
            verification: "Unit tests pass; exported the March and April invoices for Ceylon Agro on staging and compared totals against the ledger.",
            suggestedResolutionCode: "fixed",
            proposedReply: "Hi — we found that amounts above one million rupees hit a formatting bug in the PDF export. It's fixed and deployed; the March and April exports now match your ledger. Could you re-run the export and confirm?",
            timeMinutes: total,
            submittedAt: at,
            outcome,
            reviewerId: outcome ? staff.admin : null,
            reviewedAt: outcome ? new Date(at.getTime() + 90 * 60_000) : null,
            reviewNotes: outcome === "returned" ? "Please add the negative-amount case to the tests and confirm the export on the April data before we reply." : null,
            sentReply: outcome === "approved" ? "Hi — amounts above one million rupees were hitting a formatting bug in the PDF export. It's fixed and deployed; please re-run the export and confirm it matches your ledger." : null,
          })
          .returning({ id: schema.submissions.id });
        await ev("submitted", at, developer, { submissionId: s!.id, timeMinutes: total });
        await ev("status_changed", at, developer, { action: "submit", from: "in_progress", to: "in_review" });
        if (outcome === "returned") {
          await ev("review_returned", new Date(at.getTime() + 90 * 60_000), staff.admin, { submissionId: s!.id, developerId: developer, notes: "Please add the negative-amount case to the tests." });
          await comment(staff.admin, "**Returned from review**\n\nPlease add the negative-amount case to the tests and confirm the export on the April data before we reply.", "internal", new Date(at.getTime() + 90 * 60_000), "review_note");
          await ev("status_changed", new Date(at.getTime() + 90 * 60_000), staff.admin, { action: "return", from: "in_review", to: "in_progress" });
        }
        if (outcome === "approved") {
          await ev("review_approved", new Date(at.getTime() + 90 * 60_000), staff.admin, { submissionId: s!.id, developerId: developer, resolutionCode: "fixed", replyEdited: true });
          await comment(staff.admin, "Hi — amounts above one million rupees were hitting a formatting bug in the PDF export. It's fixed and deployed; please re-run the export and confirm it matches your ledger.", "public", new Date(at.getTime() + 90 * 60_000), "resolution");
          await ev("status_changed", new Date(at.getTime() + 90 * 60_000), staff.admin, { action: "approve", from: "in_review", to: "resolved", resolutionCode: "fixed" }, "public");
        }
      };
      if (plan.returned) await makeSubmission(ageFraction(0.55), "returned");
      if (plan.status === "in_review") await makeSubmission(submittedAt!, null);
      if ((plan.status === "resolved" || plan.status === "closed") && chance(0.7)) await makeSubmission(new Date(resolvedAt!.getTime() - 90 * 60_000), "approved");
    }
    if (plan.status === "pending_client") {
      await comment(developer ?? agent, STAFF_REPLIES[1]!, "public", ageFraction(0.8));
      await ev("status_changed", ageFraction(0.8), developer ?? agent, { action: "ask_client", from: "in_progress", to: "pending_client" }, "public");
    }
    if (plan.status === "on_hold") await ev("status_changed", ageFraction(0.8), developer ?? agent, { action: "hold", from: "in_progress", to: "on_hold", holdReason: plan.hold }, "public");
    if ((plan.status === "resolved" || plan.status === "closed") && !developer) await ev("status_changed", resolvedAt!, agent, { action: "resolve", from: "in_progress", to: "resolved", resolutionCode }, "public");
    if (plan.status === "closed") await ev("status_changed", closedAt!, requester.id, { action: "close", from: "resolved", to: "closed" }, "public");
    if (plan.status === "cancelled") await ev("status_changed", closedAt!, requester.id, { action: "cancel", from: "open", to: "cancelled", reason: "No longer required" }, "public");
    if (plan.escalate) await ev("escalated", ageFraction(0.6), null, { level: 1, reason: "SLA breached" });
    if (chance(0.15) && org.contacts.length > 1) {
      const p = org.contacts.find((c) => c.id !== requester.id)!;
      await db.insert(schema.ticketParticipants).values({ ticketId, userId: p.id, kind: "participant" }).onConflictDoNothing();
    }
    if (chance(0.2)) {
      const [tag] = await db.insert(schema.tags).values({ name: pick(["month-end", "vendor", "regression", "mobile", "billing"]) }).onConflictDoUpdate({ target: schema.tags.name, set: { name: sql`excluded.name` } }).returning({ id: schema.tags.id });
      await db.insert(schema.ticketTags).values({ ticketId, tagId: tag!.id }).onConflictDoNothing();
    }
  }

  // Notifications for the demo admin/devs so the bell has content
  for (const uid of [staff.admin, staff.dev1, staff.agent1]) {
    const some = await db.select({ id: schema.tickets.id, key: schema.tickets.key, subject: schema.tickets.subject, orgId: schema.tickets.orgId }).from(schema.tickets).limit(4);
    for (const s of some) await db.insert(schema.notifications).values({ userId: uid, orgId: s.orgId, ticketId: s.id, kind: "demo", title: `${s.key}: ${s.subject}`, href: `/app/tickets/${s.key}` });
  }
  const [saved] = await db.select({ id: schema.savedViews.id }).from(schema.savedViews).limit(1);
  if (!saved) {
    await db.insert(schema.savedViews).values([
      { userId: staff.admin, orgId: opts.staffOrgId, name: "P1/P2 open", query: { priority: ["p1", "p2"], queue: "all_open" } },
      { userId: staff.agent1, orgId: opts.staffOrgId, name: "Ceylon Agro", query: { orgId: orgs[0]!.id, queue: "all_open" } },
    ]);
  }
  return { orgs, staff, created };
}

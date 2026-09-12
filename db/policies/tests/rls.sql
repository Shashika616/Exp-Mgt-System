-- pgTAP tests for the RLS policies (docs/architecture.md §4.3, security.md A01).
-- Runs inside a transaction that is rolled back; fixtures below never persist.
BEGIN;
SELECT plan(36);

-- ---------------------------------------------------------------------------
-- Fixtures (as owner, RLS bypassed)
-- ---------------------------------------------------------------------------
INSERT INTO sla_policies (id, name, calendar, targets, is_default) VALUES
  ('00000000-0000-0000-0000-00000000aa01','T', '{"tz":"Asia/Colombo","hours":{"mon":[["09:00","17:00"]],"tue":[],"wed":[],"thu":[],"fri":[],"sat":[],"sun":[]},"holidays":[]}', '{"p1":{"first_response_min":30,"resolution_min":240,"calendar":"24x7"},"p2":{"first_response_min":120,"resolution_min":1440,"calendar":"24x7"},"p3":{"first_response_min":480,"resolution_min":1440,"calendar":"business"},"p4":{"first_response_min":480,"resolution_min":2400,"calendar":"business"}}', false);
INSERT INTO organisations (id, type, name, slug) VALUES
  ('00000000-0000-0000-0000-000000000001','staff','Staff T','staff-t'),
  ('00000000-0000-0000-0000-000000000002','client','Org A','org-a-t'),
  ('00000000-0000-0000-0000-000000000003','client','Org B','org-b-t');
INSERT INTO users (id, org_id, role_id, email, full_name, status) VALUES
  ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000001','admin','admin@t.test','Admin','active'),
  ('00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000001','agent','agent@t.test','Agent','active'),
  ('00000000-0000-0000-0000-000000000013','00000000-0000-0000-0000-000000000001','developer','dev1@t.test','Dev One','active'),
  ('00000000-0000-0000-0000-000000000014','00000000-0000-0000-0000-000000000001','developer','dev2@t.test','Dev Two','active'),
  ('00000000-0000-0000-0000-000000000021','00000000-0000-0000-0000-000000000002','client_admin','ca@a.test','Client Admin A','active'),
  ('00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000002','client_user','cu1@a.test','Client User A1','active'),
  ('00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000002','client_user','cu2@a.test','Client User A2','active'),
  ('00000000-0000-0000-0000-000000000031','00000000-0000-0000-0000-000000000003','client_user','cu@b.test','Client User B','active');
INSERT INTO tickets (id, key, org_id, requester_id, assignee_id, type, subject, description, status, urgency, impact, priority, source, created_by, work_state, submitted_at) VALUES
  ('00000000-0000-0000-0000-000000000101','EXP-T1','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','00000000-0000-0000-0000-000000000013','incident','A1 ticket','d','in_progress','high','medium','p2','portal','00000000-0000-0000-0000-000000000022','fix_in_progress',NULL),
  ('00000000-0000-0000-0000-000000000102','EXP-T2','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000023','00000000-0000-0000-0000-000000000014','incident','A2 ticket','d','in_review','low','low','p4','portal','00000000-0000-0000-0000-000000000023','fix_ready',now()),
  ('00000000-0000-0000-0000-000000000103','EXP-T3','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000031',NULL,'question','B ticket','d','new','low','medium','p4','portal','00000000-0000-0000-0000-000000000031',NULL,NULL);
INSERT INTO ticket_participants (ticket_id, user_id, kind) VALUES ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000022','participant');
INSERT INTO comments (id, ticket_id, org_id, author_id, visibility, body) VALUES
  ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000012','public','public reply'),
  ('00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000012','internal','internal note'),
  ('00000000-0000-0000-0000-000000000203','00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000012','public','org b public');
INSERT INTO work_logs (id, ticket_id, org_id, user_id, minutes, note) VALUES ('00000000-0000-0000-0000-000000000301','00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000013',30,'log');
INSERT INTO submissions (id, ticket_id, org_id, developer_id, findings, changes_made, verification, proposed_reply, time_minutes) VALUES
  ('00000000-0000-0000-0000-000000000401','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000014','f','c','v','r',30);
INSERT INTO ticket_events (ticket_id, org_id, actor_id, kind, visibility) VALUES
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002',NULL,'created','public'),
  ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002',NULL,'work_logged','internal');

-- Every table has RLS enabled
SELECT is((SELECT count(*)::int FROM pg_tables WHERE schemaname = 'public' AND NOT rowsecurity), 0, 'every public table has RLS enabled');
SELECT is((SELECT count(*)::int FROM pg_tables t WHERE schemaname='public' AND NOT EXISTS (SELECT 1 FROM pg_policies p WHERE p.tablename = t.tablename)), 0, 'every table has at least one policy');

-- Switch to the application role: RLS now applies
SET ROLE app_rw;

-- ---------------------------------------------------------------------------
-- Client user A1: own ticket + participant ticket, never org B
-- ---------------------------------------------------------------------------
SELECT set_config('app.role','client_user',true), set_config('app.org_id','00000000-0000-0000-0000-000000000002',true), set_config('app.user_id','00000000-0000-0000-0000-000000000022',true);
SELECT results_eq($$SELECT key FROM tickets ORDER BY key$$, $$VALUES ('EXP-T1'),('EXP-T2')$$, 'client_user sees own + participant tickets only');
SELECT is((SELECT count(*)::int FROM tickets WHERE key='EXP-T3'), 0, 'client_user cannot see another org''s ticket (IDOR)');
SELECT results_eq($$SELECT body FROM comments ORDER BY body$$, $$VALUES ('public reply')$$, 'client_user sees only public comments of own org');
SELECT is((SELECT count(*)::int FROM work_logs), 0, 'client_user sees no work logs');
SELECT is((SELECT count(*)::int FROM submissions), 0, 'client_user sees no submissions');
SELECT is((SELECT count(*)::int FROM ticket_events), 1, 'client_user sees only public ticket events');
SELECT is((SELECT count(*)::int FROM audit_log), 0, 'client_user cannot read the audit log');
SELECT throws_ok($$INSERT INTO comments (ticket_id, org_id, author_id, visibility, body) VALUES ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','internal','sneaky')$$, '42501', NULL, 'client_user cannot insert an internal comment');
SELECT lives_ok($$INSERT INTO comments (ticket_id, org_id, author_id, visibility, body) VALUES ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022','public','ok')$$, 'client_user can add a public comment on own ticket');
SELECT throws_ok($$INSERT INTO comments (ticket_id, org_id, author_id, visibility, body) VALUES ('00000000-0000-0000-0000-000000000103','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000022','public','x')$$, '42501', NULL, 'client_user cannot comment on another org''s ticket');
SELECT throws_ok($$INSERT INTO work_logs (ticket_id, org_id, user_id, minutes, note) VALUES ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000022',5,'x')$$, '42501', NULL, 'client_user cannot write work logs');
SELECT is((SELECT count(*)::int FROM users WHERE org_id='00000000-0000-0000-0000-000000000003'), 0, 'client_user cannot list another org''s contacts');
SELECT is((SELECT count(*)::int FROM organisations), 1, 'client_user sees only own organisation');

-- ---------------------------------------------------------------------------
-- Client admin A: all tickets in org A
-- ---------------------------------------------------------------------------
SELECT set_config('app.role','client_admin',true), set_config('app.org_id','00000000-0000-0000-0000-000000000002',true), set_config('app.user_id','00000000-0000-0000-0000-000000000021',true);
SELECT is((SELECT count(*)::int FROM tickets), 2, 'client_admin sees all tickets of own org');
SELECT is((SELECT count(*)::int FROM tickets WHERE org_id='00000000-0000-0000-0000-000000000003'), 0, 'client_admin sees nothing from org B');
SELECT is((SELECT count(*)::int FROM comments WHERE visibility='internal'), 0, 'client_admin sees no internal notes');
SELECT is((SELECT count(*)::int FROM submissions), 0, 'client_admin sees no submissions');

-- ---------------------------------------------------------------------------
-- Developer: only assigned tickets
-- ---------------------------------------------------------------------------
SELECT set_config('app.role','developer',true), set_config('app.org_id','00000000-0000-0000-0000-000000000001',true), set_config('app.user_id','00000000-0000-0000-0000-000000000013',true);
SELECT results_eq($$SELECT key FROM tickets$$, $$VALUES ('EXP-T1')$$, 'developer sees only tickets assigned to them');
SELECT is((SELECT count(*)::int FROM comments), 3, 'developer sees public + internal comments on assigned ticket');
SELECT is((SELECT count(*)::int FROM submissions), 0, 'developer does not see submissions of other developers'' tickets');
UPDATE tickets SET work_state='blocked' WHERE key='EXP-T2'; -- silently affects 0 rows (checked below as agent)
UPDATE tickets SET work_state='blocked' WHERE key='EXP-T1';
SELECT throws_ok($$INSERT INTO work_logs (ticket_id, org_id, user_id, minutes, note) VALUES ('00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000013',5,'x')$$, '42501', NULL, 'developer cannot log work on an unassigned ticket');
UPDATE submissions SET outcome='approved', reviewer_id='00000000-0000-0000-0000-000000000013' WHERE id='00000000-0000-0000-0000-000000000401'; -- 0 rows

-- ---------------------------------------------------------------------------
-- Agent: everything
-- ---------------------------------------------------------------------------
SELECT set_config('app.role','agent',true), set_config('app.org_id','00000000-0000-0000-0000-000000000001',true), set_config('app.user_id','00000000-0000-0000-0000-000000000012',true);
SELECT is((SELECT count(*)::int FROM tickets WHERE key LIKE 'EXP-T%'), 3, 'agent sees every ticket');
SELECT is((SELECT work_state::text FROM tickets WHERE key='EXP-T2'), 'fix_ready', 'developer update on a foreign ticket had no effect');
SELECT is((SELECT work_state::text FROM tickets WHERE key='EXP-T1'), 'blocked', 'developer update on own ticket applied');
SELECT is((SELECT outcome::text FROM submissions WHERE id='00000000-0000-0000-0000-000000000401'), NULL, 'developer could not review a submission');
SELECT is((SELECT count(*)::int FROM work_logs WHERE id='00000000-0000-0000-0000-000000000301'), 1, 'agent sees work logs');
SELECT throws_ok($$DELETE FROM tickets WHERE key='EXP-T3'$$, '42501', NULL, 'app role cannot delete tickets (soft delete only)');
SELECT throws_ok($$UPDATE ticket_events SET kind='x'$$, NULL, NULL, 'ticket_events are append-only');
SELECT throws_ok($$DELETE FROM ticket_events$$, NULL, NULL, 'ticket_events cannot be deleted');

-- ---------------------------------------------------------------------------
-- Admin: review integrity
-- ---------------------------------------------------------------------------
SELECT set_config('app.role','admin',true), set_config('app.org_id','00000000-0000-0000-0000-000000000001',true), set_config('app.user_id','00000000-0000-0000-0000-000000000011',true);
UPDATE submissions SET outcome='approved', reviewer_id='00000000-0000-0000-0000-000000000011', reviewed_at=now() WHERE id='00000000-0000-0000-0000-000000000401';
SELECT is((SELECT outcome::text FROM submissions WHERE id='00000000-0000-0000-0000-000000000401'), 'approved', 'admin can decide an open submission');
UPDATE submissions SET review_notes='again' WHERE id='00000000-0000-0000-0000-000000000401'; -- RLS hides decided rows from UPDATE; trigger is the second guard
SELECT is((SELECT review_notes FROM submissions WHERE id='00000000-0000-0000-0000-000000000401'), NULL, 'submissions are immutable after review');
RESET ROLE;
SELECT throws_ok($$UPDATE submissions SET review_notes='again' WHERE id='00000000-0000-0000-0000-000000000401'$$, NULL, NULL, 'immutability trigger also blocks the table owner');
SET ROLE app_rw;
SELECT is((SELECT count(*)::int FROM audit_log), 0, 'admin can read the audit log (empty fixture)');

-- No session context at all → nothing visible
SELECT set_config('app.role','',true), set_config('app.org_id','',true), set_config('app.user_id','',true);
SELECT is((SELECT count(*)::int FROM tickets), 0, 'no session context sees nothing');

SELECT * FROM finish();
ROLLBACK;

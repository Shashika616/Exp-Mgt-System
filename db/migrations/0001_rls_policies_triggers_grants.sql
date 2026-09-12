-- Row-Level Security, integrity triggers and least-privilege grants.
-- Portable: uses session variables set by the DAL per transaction
--   SET LOCAL app.user_id = '<uuid>'; SET LOCAL app.org_id = '<uuid>'; SET LOCAL app.role = 'agent';
-- Never auth.uid() (docs/architecture.md §4.3, docs/security.md A01).

-- ---------------------------------------------------------------------------
-- Session helpers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION app_role() RETURNS text
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.role', true), '') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_user_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.user_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_org_id() RETURNS uuid
  LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('app.org_id', true), '')::uuid $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_staff_full() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('agent','lead','admin','system') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_staff() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('agent','developer','lead','admin','system') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_client() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('client_user','client_admin') $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION app_is_admin() RETURNS boolean
  LANGUAGE sql STABLE AS $$ SELECT app_role() IN ('admin','system') $$;
--> statement-breakpoint
-- Is the current session a participant/watcher on this ticket?
CREATE OR REPLACE FUNCTION app_is_on_ticket(p_ticket_id uuid, p_kind participant_kind DEFAULT NULL) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
    SELECT EXISTS (
      SELECT 1 FROM ticket_participants p
      WHERE p.ticket_id = p_ticket_id AND p.user_id = app_user_id()
        AND (p_kind IS NULL OR p.kind = p_kind)
    )
  $$;
--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Enable RLS on every table (CI check: no table without RLS)
-- ---------------------------------------------------------------------------
ALTER TABLE organisations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE org_settings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sla_policies ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE users ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_tokens ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE local_credentials ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE auth_sessions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE ticket_participants ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE ticket_links ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE ticket_tags ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE work_logs ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE work_timers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE satisfaction_ratings ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE sla_timers ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE saved_views ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE canned_responses ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE daily_ticket_stats ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Reference data: readable by every authenticated session, writable by admin/system
-- ---------------------------------------------------------------------------
CREATE POLICY roles_read ON roles FOR SELECT USING (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY roles_admin ON roles FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY permissions_read ON permissions FOR SELECT USING (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY permissions_admin ON permissions FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY role_permissions_read ON role_permissions FOR SELECT USING (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY role_permissions_admin ON role_permissions FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY categories_read ON categories FOR SELECT USING (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY categories_admin ON categories FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY tags_staff ON tags FOR ALL USING (app_is_staff());--> statement-breakpoint
CREATE POLICY sla_policies_read ON sla_policies FOR SELECT USING (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY sla_policies_admin ON sla_policies FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY feature_flags_read ON feature_flags FOR SELECT USING (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY feature_flags_admin ON feature_flags FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY rate_limits_system ON rate_limits FOR ALL USING (app_role() = 'system');--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Organisations & settings
-- ---------------------------------------------------------------------------
CREATE POLICY organisations_staff ON organisations FOR SELECT USING (app_is_staff());--> statement-breakpoint
CREATE POLICY organisations_client_own ON organisations FOR SELECT USING (app_is_client() AND id = app_org_id());--> statement-breakpoint
CREATE POLICY organisations_admin ON organisations FOR ALL USING (app_is_admin());--> statement-breakpoint
CREATE POLICY org_settings_staff ON org_settings FOR SELECT USING (app_is_staff());--> statement-breakpoint
CREATE POLICY org_settings_client_own ON org_settings FOR SELECT USING (app_is_client() AND org_id = app_org_id());--> statement-breakpoint
CREATE POLICY org_settings_admin ON org_settings FOR ALL USING (app_is_admin());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Users: staff see all; clients see their own org's contacts and (name-only via DAL) staff users
-- ---------------------------------------------------------------------------
CREATE POLICY users_staff_read ON users FOR SELECT USING (app_is_staff());--> statement-breakpoint
CREATE POLICY users_client_read ON users FOR SELECT USING (
  app_is_client() AND (
    org_id = app_org_id()
    OR EXISTS (SELECT 1 FROM organisations o WHERE o.id = users.org_id AND o.type = 'staff')
  )
);--> statement-breakpoint
CREATE POLICY users_self_update ON users FOR UPDATE USING (id = app_user_id()) WITH CHECK (id = app_user_id());--> statement-breakpoint
CREATE POLICY users_client_admin_manage ON users FOR ALL USING (
  app_role() = 'client_admin' AND org_id = app_org_id()
) WITH CHECK (app_role() = 'client_admin' AND org_id = app_org_id() AND role_id IN ('client_user','client_admin'));--> statement-breakpoint
CREATE POLICY users_admin ON users FOR ALL USING (app_is_admin());--> statement-breakpoint

-- Auth tables: only the system context (login flows, provider adapters) touches them
CREATE POLICY invitations_system ON invitations FOR ALL USING (app_role() = 'system');--> statement-breakpoint
CREATE POLICY invitations_admin_read ON invitations FOR SELECT USING (app_is_admin() OR (app_role() = 'client_admin' AND org_id = app_org_id()));--> statement-breakpoint
CREATE POLICY auth_tokens_system ON auth_tokens FOR ALL USING (app_role() = 'system');--> statement-breakpoint
CREATE POLICY local_credentials_system ON local_credentials FOR ALL USING (app_role() = 'system');--> statement-breakpoint
CREATE POLICY auth_sessions_system ON auth_sessions FOR ALL USING (app_role() = 'system');--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Tickets
-- ---------------------------------------------------------------------------
CREATE POLICY tickets_staff_all ON tickets FOR ALL USING (app_is_staff_full());--> statement-breakpoint
-- developers: only tickets assigned to them or watched
CREATE POLICY tickets_developer ON tickets FOR SELECT USING (
  app_role() = 'developer' AND (assignee_id = app_user_id() OR app_is_on_ticket(id, 'watcher'))
);--> statement-breakpoint
CREATE POLICY tickets_developer_update ON tickets FOR UPDATE USING (
  app_role() = 'developer' AND assignee_id = app_user_id()
) WITH CHECK (app_role() = 'developer' AND assignee_id = app_user_id());--> statement-breakpoint
-- clients: own org, and own/participant tickets unless client_admin
CREATE POLICY tickets_client_org ON tickets FOR SELECT USING (
  app_is_client() AND org_id = app_org_id() AND (
    app_role() = 'client_admin' OR requester_id = app_user_id() OR app_is_on_ticket(id, 'participant')
  )
);--> statement-breakpoint
CREATE POLICY tickets_client_insert ON tickets FOR INSERT WITH CHECK (
  app_is_client() AND org_id = app_org_id() AND created_by = app_user_id()
);--> statement-breakpoint
CREATE POLICY tickets_client_update ON tickets FOR UPDATE USING (
  app_is_client() AND org_id = app_org_id() AND (
    app_role() = 'client_admin' OR requester_id = app_user_id() OR app_is_on_ticket(id, 'participant')
  )
) WITH CHECK (app_is_client() AND org_id = app_org_id());--> statement-breakpoint

CREATE POLICY ticket_participants_staff ON ticket_participants FOR ALL USING (app_is_staff());--> statement-breakpoint
CREATE POLICY ticket_participants_client ON ticket_participants FOR SELECT USING (
  app_is_client() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_participants.ticket_id)
);--> statement-breakpoint
CREATE POLICY ticket_participants_client_insert ON ticket_participants FOR INSERT WITH CHECK (
  app_is_client() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_participants.ticket_id)
  AND kind = 'participant'
  AND EXISTS (SELECT 1 FROM users u WHERE u.id = ticket_participants.user_id AND u.org_id = app_org_id())
);--> statement-breakpoint
CREATE POLICY ticket_links_staff ON ticket_links FOR ALL USING (app_is_staff());--> statement-breakpoint
CREATE POLICY ticket_links_client ON ticket_links FOR SELECT USING (
  app_is_client() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_links.ticket_id)
);--> statement-breakpoint
CREATE POLICY ticket_links_client_insert ON ticket_links FOR INSERT WITH CHECK (
  app_is_client() AND kind = 'follow_up_of'
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_links.ticket_id)
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_links.linked_ticket_id)
);--> statement-breakpoint
CREATE POLICY ticket_tags_staff ON ticket_tags FOR ALL USING (app_is_staff());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Comments: clients only ever see public comments in their own org
-- ---------------------------------------------------------------------------
CREATE POLICY comments_staff_read ON comments FOR SELECT USING (
  app_is_staff() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = comments.ticket_id)
);--> statement-breakpoint
CREATE POLICY comments_staff_write ON comments FOR INSERT WITH CHECK (
  app_is_staff() AND author_id = app_user_id() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = comments.ticket_id)
);--> statement-breakpoint
CREATE POLICY comments_staff_update ON comments FOR UPDATE USING (
  app_is_staff() AND (author_id = app_user_id() OR app_is_admin())
);--> statement-breakpoint
CREATE POLICY comments_client_public_only ON comments FOR SELECT USING (
  app_is_client() AND visibility = 'public' AND org_id = app_org_id()
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = comments.ticket_id)
);--> statement-breakpoint
CREATE POLICY comments_client_insert ON comments FOR INSERT WITH CHECK (
  app_is_client() AND visibility = 'public' AND org_id = app_org_id() AND author_id = app_user_id()
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = comments.ticket_id)
);--> statement-breakpoint

CREATE POLICY attachments_staff ON attachments FOR ALL USING (
  app_is_staff() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = attachments.ticket_id)
);--> statement-breakpoint
CREATE POLICY attachments_client_read ON attachments FOR SELECT USING (
  app_is_client() AND visibility = 'public' AND org_id = app_org_id()
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = attachments.ticket_id)
);--> statement-breakpoint
CREATE POLICY attachments_client_insert ON attachments FOR INSERT WITH CHECK (
  app_is_client() AND visibility = 'public' AND org_id = app_org_id() AND uploader_id = app_user_id()
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = attachments.ticket_id)
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Work logs, timers, submissions: staff only — client roles have NO policy (deny)
-- ---------------------------------------------------------------------------
CREATE POLICY work_logs_staff_read ON work_logs FOR SELECT USING (
  app_is_staff() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = work_logs.ticket_id)
);--> statement-breakpoint
CREATE POLICY work_logs_owner_write ON work_logs FOR INSERT WITH CHECK (
  app_is_staff() AND user_id = app_user_id() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = work_logs.ticket_id)
);--> statement-breakpoint
CREATE POLICY work_logs_owner_update ON work_logs FOR UPDATE USING (
  app_is_staff() AND (user_id = app_user_id() OR app_is_admin())
);--> statement-breakpoint
CREATE POLICY work_timers_owner ON work_timers FOR ALL USING (app_is_staff() AND user_id = app_user_id());--> statement-breakpoint
CREATE POLICY work_timers_staff_read ON work_timers FOR SELECT USING (app_is_staff_full());--> statement-breakpoint
CREATE POLICY submissions_staff_read ON submissions FOR SELECT USING (
  app_is_staff() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = submissions.ticket_id)
);--> statement-breakpoint
CREATE POLICY submissions_developer_insert ON submissions FOR INSERT WITH CHECK (
  app_is_staff() AND developer_id = app_user_id() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = submissions.ticket_id)
);--> statement-breakpoint
-- immutable after review: only lead/admin/system may update, and only while undecided
CREATE POLICY submissions_review ON submissions FOR UPDATE USING (
  app_role() IN ('lead','admin','system') AND outcome IS NULL
);--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Ticket events (append-only): clients see only public events of their org
-- ---------------------------------------------------------------------------
CREATE POLICY ticket_events_staff_read ON ticket_events FOR SELECT USING (
  app_is_staff() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_events.ticket_id)
);--> statement-breakpoint
CREATE POLICY ticket_events_client_read ON ticket_events FOR SELECT USING (
  app_is_client() AND visibility = 'public' AND org_id = app_org_id()
  AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_events.ticket_id)
);--> statement-breakpoint
CREATE POLICY ticket_events_insert ON ticket_events FOR INSERT WITH CHECK (
  app_role() IS NOT NULL AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = ticket_events.ticket_id)
);--> statement-breakpoint

CREATE POLICY satisfaction_staff ON satisfaction_ratings FOR SELECT USING (app_is_staff());--> statement-breakpoint
CREATE POLICY satisfaction_client ON satisfaction_ratings FOR ALL USING (
  app_is_client() AND org_id = app_org_id() AND user_id = app_user_id()
) WITH CHECK (app_is_client() AND org_id = app_org_id() AND user_id = app_user_id());--> statement-breakpoint

-- SLA timers: staff full; clients read their own org's (portal shows target dates only)
CREATE POLICY sla_timers_staff ON sla_timers FOR ALL USING (app_is_staff());--> statement-breakpoint
CREATE POLICY sla_timers_client_read ON sla_timers FOR SELECT USING (
  app_is_client() AND org_id = app_org_id() AND EXISTS (SELECT 1 FROM tickets t WHERE t.id = sla_timers.ticket_id)
);--> statement-breakpoint

-- Notifications: own rows only (system inserts)
CREATE POLICY notifications_own ON notifications FOR SELECT USING (user_id = app_user_id());--> statement-breakpoint
CREATE POLICY notifications_own_update ON notifications FOR UPDATE USING (user_id = app_user_id());--> statement-breakpoint
CREATE POLICY notifications_insert ON notifications FOR INSERT WITH CHECK (app_role() IS NOT NULL);--> statement-breakpoint
CREATE POLICY notifications_system ON notifications FOR ALL USING (app_role() = 'system');--> statement-breakpoint

CREATE POLICY saved_views_own ON saved_views FOR ALL USING (user_id = app_user_id()) WITH CHECK (user_id = app_user_id());--> statement-breakpoint
CREATE POLICY canned_responses_staff ON canned_responses FOR SELECT USING (app_is_staff());--> statement-breakpoint
CREATE POLICY canned_responses_manage ON canned_responses FOR ALL USING (app_role() IN ('agent','lead','admin','system'));--> statement-breakpoint
CREATE POLICY email_templates_read ON email_templates FOR SELECT USING (app_is_staff());--> statement-breakpoint
CREATE POLICY email_templates_admin ON email_templates FOR ALL USING (app_is_admin());--> statement-breakpoint

-- Audit log: admin reads; any authenticated session may append (access_denied is logged by the requester's context)
CREATE POLICY audit_log_admin_read ON audit_log FOR SELECT USING (app_is_admin());--> statement-breakpoint
CREATE POLICY audit_log_insert ON audit_log FOR INSERT WITH CHECK (app_role() IS NOT NULL);--> statement-breakpoint

CREATE POLICY daily_stats_staff ON daily_ticket_stats FOR ALL USING (app_is_staff());--> statement-breakpoint
CREATE POLICY daily_stats_client ON daily_ticket_stats FOR SELECT USING (app_is_client() AND org_id = app_org_id());--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Integrity triggers
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
--> statement-breakpoint
CREATE TRIGGER organisations_updated_at BEFORE UPDATE ON organisations FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER tickets_updated_at BEFORE UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER work_logs_updated_at BEFORE UPDATE ON work_logs FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER sla_policies_updated_at BEFORE UPDATE ON sla_policies FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER sla_timers_updated_at BEFORE UPDATE ON sla_timers FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER canned_responses_updated_at BEFORE UPDATE ON canned_responses FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER email_templates_updated_at BEFORE UPDATE ON email_templates FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint
CREATE TRIGGER org_settings_updated_at BEFORE UPDATE ON org_settings FOR EACH ROW EXECUTE FUNCTION set_updated_at();--> statement-breakpoint

-- Submissions are immutable once decided
CREATE OR REPLACE FUNCTION submissions_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.outcome IS NOT NULL THEN
    RAISE EXCEPTION 'submission % is immutable after review', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER submissions_immutable_trg BEFORE UPDATE ON submissions FOR EACH ROW EXECUTE FUNCTION submissions_immutable();--> statement-breakpoint
CREATE OR REPLACE FUNCTION deny_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'rows in % cannot be deleted', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege'; END $$;
--> statement-breakpoint
CREATE TRIGGER submissions_no_delete BEFORE DELETE ON submissions FOR EACH ROW EXECUTE FUNCTION deny_delete();--> statement-breakpoint

-- Audit tables are append-only
CREATE OR REPLACE FUNCTION deny_update_delete() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'table % is append-only', TG_TABLE_NAME USING ERRCODE = 'insufficient_privilege'; END $$;
--> statement-breakpoint
CREATE TRIGGER ticket_events_append_only BEFORE UPDATE OR DELETE ON ticket_events FOR EACH ROW EXECUTE FUNCTION deny_update_delete();--> statement-breakpoint
CREATE TRIGGER audit_log_append_only BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION deny_update_delete();--> statement-breakpoint

-- Work logs: editable by the author for 24 h, then locked (admin may still soft-delete)
CREATE OR REPLACE FUNCTION work_logs_edit_window() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.created_at < now() - interval '24 hours' AND NOT app_is_admin() THEN
    RAISE EXCEPTION 'work log % is locked after 24 hours', OLD.id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER work_logs_edit_window_trg BEFORE UPDATE ON work_logs FOR EACH ROW EXECUTE FUNCTION work_logs_edit_window();--> statement-breakpoint

-- tickets.time_spent_minutes = sum(work_logs.minutes) maintained in the same transaction (ADR-11)
CREATE OR REPLACE FUNCTION recompute_ticket_time() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_ticket uuid;
BEGIN
  v_ticket := COALESCE(NEW.ticket_id, OLD.ticket_id);
  UPDATE tickets SET time_spent_minutes = COALESCE((
    SELECT sum(minutes) FROM work_logs WHERE ticket_id = v_ticket AND deleted_at IS NULL), 0)
  WHERE id = v_ticket;
  RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER work_logs_recompute_time AFTER INSERT OR UPDATE OR DELETE ON work_logs FOR EACH ROW EXECUTE FUNCTION recompute_ticket_time();--> statement-breakpoint

-- Priority must match the impact × urgency matrix unless explicitly overridden (ADR-05)
CREATE OR REPLACE FUNCTION compute_priority(p_impact level3, p_urgency level3) RETURNS priority
  LANGUAGE sql IMMUTABLE AS $$
    SELECT CASE
      WHEN p_impact = 'high' AND p_urgency = 'high' THEN 'p1'::priority
      WHEN (p_impact = 'high' AND p_urgency = 'medium') OR (p_impact = 'medium' AND p_urgency = 'high') THEN 'p2'::priority
      WHEN (p_impact = 'high' AND p_urgency = 'low') OR (p_impact = 'medium' AND p_urgency = 'medium') OR (p_impact = 'low' AND p_urgency = 'high') THEN 'p3'::priority
      ELSE 'p4'::priority END
  $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION tickets_check_priority() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT NEW.priority_overridden AND NEW.priority <> compute_priority(NEW.impact, NEW.urgency) THEN
    RAISE EXCEPTION 'priority % does not match impact %/urgency %', NEW.priority, NEW.impact, NEW.urgency USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
CREATE TRIGGER tickets_check_priority_trg BEFORE INSERT OR UPDATE ON tickets FOR EACH ROW EXECUTE FUNCTION tickets_check_priority();--> statement-breakpoint

-- ---------------------------------------------------------------------------
-- Least-privilege application role (created by db/docker/init.sql locally; by the runbook on Supabase)
-- ---------------------------------------------------------------------------
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'app_rw') THEN
    CREATE ROLE app_rw LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
  END IF;
END $$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app_rw;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_rw;--> statement-breakpoint
REVOKE UPDATE, DELETE ON ticket_events, audit_log FROM app_rw;--> statement-breakpoint
REVOKE DELETE ON submissions, work_logs, tickets, comments FROM app_rw;--> statement-breakpoint
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_rw;--> statement-breakpoint
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO app_rw;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_rw;--> statement-breakpoint
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_rw;--> statement-breakpoint
ALTER ROLE app_rw SET statement_timeout = '10s';--> statement-breakpoint
-- pg-boss keeps its queue in its own schema; the worker connects with the same role
DO $$ BEGIN EXECUTE format('GRANT CREATE ON DATABASE %I TO app_rw', current_database()); END $$;

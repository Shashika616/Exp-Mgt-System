import { pgEnum } from "drizzle-orm/pg-core";

// Enum values are the single source of truth shared with lib/domain (see lib/domain/types.ts).
export const orgTypeEnum = pgEnum("org_type", ["staff", "client"]);
export const orgTierEnum = pgEnum("org_tier", ["standard", "priority", "enterprise"]);
export const ticketTypeEnum = pgEnum("ticket_type", [
  "incident",
  "service_request",
  "change_request",
  "question",
  "project_enquiry",
]);
export const ticketStatusEnum = pgEnum("ticket_status", [
  "new",
  "open",
  "in_progress",
  "in_review",
  "pending_client",
  "on_hold",
  "resolved",
  "closed",
  "cancelled",
]);
export const workStateEnum = pgEnum("work_state", [
  "investigating",
  "fix_in_progress",
  "fix_ready",
  "blocked",
  "needs_info",
]);
export const reviewOutcomeEnum = pgEnum("review_outcome", ["approved", "returned"]);
export const level3Enum = pgEnum("level3", ["low", "medium", "high"]);
export const priorityEnum = pgEnum("priority", ["p1", "p2", "p3", "p4"]);
export const holdReasonEnum = pgEnum("hold_reason", [
  "awaiting_vendor",
  "awaiting_change_window",
  "awaiting_approval",
  "awaiting_third_party",
  "other",
]);
export const resolutionCodeEnum = pgEnum("resolution_code", [
  "fixed",
  "workaround",
  "configuration",
  "user_education",
  "not_reproducible",
  "duplicate",
  "wont_fix",
  "cancelled_by_client",
  "no_response",
]);
export const visibilityEnum = pgEnum("visibility", ["public", "internal"]);
export const ticketSourceEnum = pgEnum("ticket_source", [
  "portal",
  "agent",
  "email",
  "website_form",
  "api",
]);
export const userStatusEnum = pgEnum("user_status", ["invited", "active", "deactivated"]);
export const participantKindEnum = pgEnum("participant_kind", ["participant", "watcher"]);
export const linkKindEnum = pgEnum("link_kind", ["duplicate_of", "related", "follow_up_of", "blocked_by"]);
export const slaMetricEnum = pgEnum("sla_metric", ["first_response", "resolution"]);
export const developerPublicReplyEnum = pgEnum("developer_public_reply", [
  "always",
  "after_first_admin_reply",
  "never",
]);

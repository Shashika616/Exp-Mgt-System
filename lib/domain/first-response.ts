import type { Role, TicketStatus, Visibility } from "./types";
import { isStaffRole } from "./types";

/**
 * requirements.md §5.3 — `first_responded_at` is set by the first *public* comment by staff
 * (internal notes don't count; a developer's public reply does), or by the first staff status change to
 * in_progress / pending_client / resolved — whichever comes first.
 */
export function commentCountsAsFirstResponse(authorRole: Role, visibility: Visibility): boolean {
  return isStaffRole(authorRole) && authorRole !== "system" && visibility === "public";
}

const FIRST_RESPONSE_STATUSES: readonly TicketStatus[] = ["in_progress", "pending_client", "resolved"];

export function statusChangeCountsAsFirstResponse(actorRole: Role, to: TicketStatus): boolean {
  return isStaffRole(actorRole) && actorRole !== "system" && FIRST_RESPONSE_STATUSES.includes(to);
}

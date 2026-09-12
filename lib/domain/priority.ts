import type { Level3, Priority, Role } from "./types";

/**
 * ServiceNow-style Impact × Urgency matrix (requirements.md §4.3).
 *
 *              Urgency: high    medium   low
 * Impact high:          P1      P2       P3
 * Impact medium:        P2      P3       P4
 * Impact low:           P3      P4       P4
 */
const MATRIX: Record<Level3, Record<Level3, Priority>> = {
  high: { high: "p1", medium: "p2", low: "p3" },
  medium: { high: "p2", medium: "p3", low: "p4" },
  low: { high: "p3", medium: "p4", low: "p4" },
};

export function computePriority(impact: Level3, urgency: Level3): Priority {
  return MATRIX[impact][urgency];
}

export const PRIORITY_OVERRIDE_ROLES: readonly Role[] = ["lead", "admin"];

export function canOverridePriority(role: Role): boolean {
  return PRIORITY_OVERRIDE_ROLES.includes(role);
}

/** Sorting weight: P1 first. */
export function priorityRank(p: Priority): number {
  return { p1: 0, p2: 1, p3: 2, p4: 3 }[p];
}

// Status / priority / SLA → colour + icon map (docs/design.md §1.2, §6). Single source for every badge.
import {
  Archive,
  CheckCircle2,
  CircleDot,
  ClipboardCheck,
  Clock,
  Flag,
  Inbox,
  LoaderCircle,
  NotebookPen,
  OctagonAlert,
  PauseCircle,
  Search,
  Timer,
  Wrench,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import type { Priority, TicketStatus, WorkState } from "@/lib/domain/types";
import type { SlaState } from "@/lib/dal/tickets";

export type Tone = "info" | "success" | "warning" | "danger" | "neutral" | "progress" | "review";

export const TONE_CLASS: Record<Tone, string> = {
  info: "bg-info-bg text-info-fg border-info-border",
  success: "bg-success-bg text-success-fg border-success-border",
  warning: "bg-warning-bg text-warning-fg border-warning-border",
  danger: "bg-danger-bg text-danger-fg border-danger-border",
  neutral: "bg-neutral-bg text-neutral-fg border-neutral-border",
  progress: "bg-progress-bg text-progress-fg border-progress-border",
  review: "bg-review-bg text-review-fg border-review-border",
};

export const TONE_DOT: Record<Tone, string> = {
  info: "bg-info-fg",
  success: "bg-success-fg",
  warning: "bg-warning-fg",
  danger: "bg-danger-fg",
  neutral: "bg-neutral-fg",
  progress: "bg-progress-fg",
  review: "bg-review-fg",
};

export const STATUS_META: Record<TicketStatus, { tone: Tone; icon: LucideIcon }> = {
  new: { tone: "info", icon: Inbox },
  open: { tone: "info", icon: CircleDot },
  in_progress: { tone: "progress", icon: LoaderCircle },
  in_review: { tone: "review", icon: ClipboardCheck },
  pending_client: { tone: "warning", icon: Clock },
  on_hold: { tone: "neutral", icon: PauseCircle },
  resolved: { tone: "success", icon: CheckCircle2 },
  closed: { tone: "neutral", icon: Archive },
  cancelled: { tone: "neutral", icon: XCircle },
};

export const PRIORITY_META: Record<Priority, { tone: Tone; icon: LucideIcon; short: string }> = {
  p1: { tone: "danger", icon: Flag, short: "P1" },
  p2: { tone: "warning", icon: Flag, short: "P2" },
  p3: { tone: "info", icon: Flag, short: "P3" },
  p4: { tone: "neutral", icon: Flag, short: "P4" },
};

export const WORK_STATE_META: Record<WorkState, { tone: Tone; icon: LucideIcon }> = {
  investigating: { tone: "neutral", icon: Search },
  fix_in_progress: { tone: "progress", icon: Wrench },
  fix_ready: { tone: "success", icon: CheckCircle2 },
  blocked: { tone: "danger", icon: OctagonAlert },
  needs_info: { tone: "warning", icon: NotebookPen },
};

export const SLA_META: Record<SlaState, { tone: Tone; label: string; icon: LucideIcon }> = {
  running: { tone: "info", label: "On track", icon: Timer },
  paused: { tone: "neutral", label: "Paused", icon: PauseCircle },
  at_risk: { tone: "warning", label: "At risk", icon: Timer },
  breached: { tone: "danger", label: "Breached", icon: Timer },
  met: { tone: "success", label: "Met", icon: CheckCircle2 },
  met_late: { tone: "danger", label: "Met late", icon: CheckCircle2 },
  none: { tone: "neutral", label: "No target", icon: Timer },
};

import { notFound } from "next/navigation";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { ticketExistsForViewer } from "@/lib/dal/tickets";

/**
 * Runs before the page's loading boundary so cross-tenant / unassigned tickets return an HTTP 404
 * (security.md A01) instead of a streamed 200 with a not-found body. RLS decides visibility.
 */
export default async function TicketLayout({ children, params }: { children: React.ReactNode; params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!/^EXP-\d+$/.test(key)) notFound();
  const ctx = await requireUserOrRedirect("app", `/app/tickets/${key}`);
  if (!(await ticketExistsForViewer(ctx, key))) notFound();
  return children;
}

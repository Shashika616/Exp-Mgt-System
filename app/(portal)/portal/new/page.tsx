import { NewRequest } from "@/components/portal/new-request";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { listCategories } from "@/lib/dal/categories";
import { findFollowUpSource } from "@/lib/dal/portal/tickets";

export const metadata = { title: "New request" };

export default async function NewRequestPage({ searchParams }: { searchParams: Promise<{ followUpOf?: string }> }) {
  const ctx = await requireUserOrRedirect("portal", "/portal/new");
  const { followUpOf } = await searchParams;
  const categories = await listCategories(ctx);
  const source = followUpOf && /^EXP-\d+$/.test(followUpOf) ? await findFollowUpSource(ctx, followUpOf).catch(() => null) : null;
  return <NewRequest categories={categories.filter((c) => !c.parentId).map((c) => ({ id: c.id, name: c.name }))} followUpOf={source ? { key: source.key, subject: source.subject, type: source.type } : null} />;
}

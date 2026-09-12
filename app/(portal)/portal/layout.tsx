import Image from "next/image";
import Link from "next/link";
import { requireUserOrRedirect } from "@/lib/auth/require";
import { listNotifications } from "@/lib/dal/notifications";
import { PortalNav } from "@/components/portal/portal-nav";
import { Topbar } from "@/components/shell/topbar";

export const dynamic = "force-dynamic";

/** Client portal shell (design.md §8.2): banner strip with the wordmark, top nav, no sidebar. Mobile-first. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireUserOrRedirect("portal", "/portal");
  const notifications = await listNotifications(ctx, 1);
  return (
    <div className="min-h-dvh bg-background">
      <div className="bg-primary-container text-on-primary">
        <div className="mx-auto flex h-14 max-w-[1100px] items-center gap-3 px-page">
          <Link href="/portal" className="flex items-center gap-3">
            <Image src="/brand/expendables-logo.png" alt="EXPENDABLES" width={36} height={36} className="rounded-md" priority />
            <span className="text-headline-sm uppercase tracking-wide">Expendables</span>
            <span className="hidden text-body-sm text-secondary-fixed-dim sm:inline">· Client support</span>
          </Link>
          <span className="flex-1" />
          <PortalNav isClientAdmin={ctx.role === "client_admin"} />
        </div>
      </div>
      <Topbar surface="portal" crumbs={[{ href: "/portal", label: "My requests" }]} user={{ name: ctx.fullName, email: ctx.email, role: ctx.role }} unread={notifications.unread} />
      <main id="main" className="mx-auto w-full max-w-[1100px] px-page py-6 pb-24">
        {children}
      </main>
    </div>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const ITEMS = [
  ["/app/admin/users", "Staff & roles"],
  ["/app/admin/orgs", "Client organisations"],
  ["/app/admin/categories", "Categories & canned"],
  ["/app/admin/sla", "SLA policies"],
  ["/app/admin/templates", "Email templates"],
  ["/app/admin/settings", "Settings"],
  ["/app/admin/audit", "Audit log"],
] as const;

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Admin" className="lg:sticky lg:top-[calc(var(--topbar-height)+24px)] lg:self-start">
      <ul className="flex gap-1 overflow-x-auto lg:flex-col">
        {ITEMS.map(([href, label]) => (
          <li key={href}>
            <Link href={href} aria-current={pathname.startsWith(href) ? "page" : undefined} className={cn("pressable block whitespace-nowrap rounded-md px-3 py-2 text-label text-on-surface-variant hover:bg-surface-container", pathname.startsWith(href) && "bg-primary-fixed/50 text-primary")}>
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";

export function PortalNav({ isClientAdmin }: { isClientAdmin: boolean }) {
  const pathname = usePathname();
  const items = [["/portal", "My requests"], ...(isClientAdmin ? [["/portal/team", "Team"]] : [])] as const;
  return (
    <nav aria-label="Portal" className="flex items-center gap-1">
      {items.map(([href, label]) => (
        <Link key={href} href={href} aria-current={pathname === href ? "page" : undefined} className={cn("pressable hidden h-9 items-center rounded-md px-3 text-label text-secondary-fixed-dim hover:bg-white/10 hover:text-on-primary sm:flex", pathname === href && "bg-white/10 text-on-primary")}>
          {label}
        </Link>
      ))}
      <Link href="/portal/new" className="pressable ml-2 inline-flex h-9 items-center gap-2 rounded-md bg-secondary-container px-3 text-label text-on-secondary hover:bg-secondary" data-testid="new-request">
        <Plus className="size-4" strokeWidth={2} /> New request
      </Link>
    </nav>
  );
}

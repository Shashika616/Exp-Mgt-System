"use client";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Building2, ClipboardCheck, Code2, Inbox, LayoutDashboard, PanelLeftClose, PanelLeftOpen, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipProvider } from "@/components/ui/menu";
import type { NavItem } from "./nav";
const ICONS = { dashboard: LayoutDashboard, tickets: Inbox, work: Code2, review: ClipboardCheck, clients: Building2, reports: BarChart3, admin: Settings } as const;

/** docs/design.md §8.1 - solid navy structural sidebar, 260px, ⌘B collapses to a 64px icon rail. */
export function Sidebar({ items }: { items: NavItem[] }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => {
    // Read the persisted preference after mount (outside the render/effect sync path).
    const raf = requestAnimationFrame(() => {
      try {
        setCollapsed(localStorage.getItem("exp.sidebar") === "rail");
      } catch {}
    });
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setCollapsed((c) => {
          try {
            localStorage.setItem("exp.sidebar", c ? "full" : "rail");
          } catch {}
          return !c;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-current", collapsed ? "var(--sidebar-rail)" : "var(--sidebar-width)");
  }, [collapsed]);

  return (
    <TooltipProvider delay={300}>
      <nav aria-label="Main" className={cn("fixed inset-y-0 left-0 z-30 hidden flex-col bg-primary-container text-on-primary transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex", collapsed ? "w-[var(--sidebar-rail)]" : "w-[var(--sidebar-width)]")}>
        <div className={cn("flex h-[var(--topbar-height)] shrink-0 items-center gap-3 px-4", collapsed && "justify-center px-0")}>
          <Image src="/brand/expendables-logo.png" alt="EXPENDABLES" width={36} height={36} className="rounded-md" priority />
          {!collapsed ? <span className="text-headline-sm truncate uppercase tracking-wide text-on-primary">Expendables</span> : null}
        </div>
        <ul className="mt-2 flex flex-1 flex-col gap-0.5 px-2">
          {items.map((item) => {
            const Icon = ICONS[item.icon];
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const link = (
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "pressable relative flex h-10 items-center gap-3 rounded-md px-3 text-label text-secondary-fixed-dim hover:bg-white/10 hover:text-on-primary",
                  active && "bg-white/10 text-on-primary before:absolute before:inset-y-2 before:left-0 before:w-0.5 before:rounded-full before:bg-secondary-container",
                  collapsed && "justify-center px-0",
                )}
              >
                <Icon className="size-5 shrink-0" strokeWidth={1.75} aria-hidden />
                {!collapsed ? <span className="flex-1 truncate">{item.label}</span> : null}
                {!collapsed && item.badge ? <span className="tabular rounded-full bg-white/15 px-2 py-0.5 text-[11px] font-semibold text-on-primary">{item.badge}</span> : null}
                {collapsed && item.badge ? <span className="absolute right-2 top-1.5 size-1.5 rounded-full bg-secondary-container" aria-hidden /> : null}
              </Link>
            );
            return <li key={item.href}>{collapsed ? <Tooltip content={item.label}>{link}</Tooltip> : link}</li>;
          })}
        </ul>
        <div className="p-2">
          <button
            type="button"
            onClick={() => {
              setCollapsed((c) => {
                try {
                  localStorage.setItem("exp.sidebar", c ? "full" : "rail");
                } catch {}
                return !c;
              });
            }}
            className={cn("pressable flex h-10 w-full items-center gap-3 rounded-md px-3 text-label text-secondary-fixed-dim hover:bg-white/10 hover:text-on-primary", collapsed && "justify-center px-0")}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title="⌘B"
          >
            {collapsed ? <PanelLeftOpen className="size-5" strokeWidth={1.75} /> : <PanelLeftClose className="size-5" strokeWidth={1.75} />}
            {!collapsed ? <span>Collapse</span> : null}
          </button>
        </div>
      </nav>
      {/* Mobile bottom nav */}
      <nav aria-label="Main" className="fixed inset-x-0 bottom-0 z-30 flex border-t border-outline-variant/60 bg-surface-container-lowest md:hidden">
        {items.slice(0, 5).map((item) => {
          const Icon = ICONS[item.icon];
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined} className={cn("pressable flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-heading font-medium text-on-surface-variant", active && "text-secondary")}>
              <Icon className="size-5" strokeWidth={1.75} aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </TooltipProvider>
  );
}

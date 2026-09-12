"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Command, LogOut, Search, Timer, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { signOut } from "@/lib/actions/auth";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/kbd";
import { Menu } from "@/components/ui/menu";
import { cn } from "@/lib/utils";
import { CommandPalette } from "./command-palette";
import { NotificationsPopover } from "./notifications";
import { TimerIndicator } from "./timer-indicator";

export type Crumb = { href?: string; label: string };

/** docs/design.md §4 - translucent bar, no border, scroll-edge fade once content has scrolled ≥ 1px. */
export function Topbar({ crumbs, user, unread, surface = "app", timer }: { crumbs?: Crumb[]; user: { name: string; email: string; role: string }; unread: number; surface?: "app" | "portal"; timer?: { key: string; startedAt: string } | null }) {
  const [scrolled, setScrolled] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const router = useRouter();
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 0);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  useEffect(() => {
    if (surface !== "app") return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [surface]);

  return (
    <header data-scrolled={scrolled} className={cn("scroll-edge material-topbar sticky top-0 z-20 flex h-[var(--topbar-height)] items-center gap-3 px-page", surface === "app" && "md:pl-6")}>
      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-body-sm text-on-surface-variant">
          {(crumbs ?? []).map((c, i) => (
            <li key={i} className="flex min-w-0 items-center gap-1.5">
              {i > 0 ? <span aria-hidden>/</span> : null}
              {c.href ? (
                <Link href={c.href} className="truncate hover:text-primary">
                  {c.label}
                </Link>
              ) : (
                <span className="truncate text-primary" aria-current="page">
                  {c.label}
                </span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      {timer ? <TimerIndicator ticketKey={timer.key} startedAt={timer.startedAt} /> : null}
      {surface === "app" ? (
        <button type="button" onClick={() => setPaletteOpen(true)} className="pressable hidden h-9 items-center gap-2 rounded-md border border-outline-variant/60 bg-surface-container-lowest/70 px-3 text-body-sm text-on-surface-variant hover:border-outline sm:flex" aria-label="Search (⌘K)">
          <Search className="size-4" strokeWidth={1.75} aria-hidden />
          <span className="w-32 text-left">Search…</span>
          <Kbd>⌘K</Kbd>
        </button>
      ) : null}
      {surface === "app" ? (
        <Button variant="ghost" size="icon" className="sm:hidden" onClick={() => setPaletteOpen(true)} aria-label="Search">
          <Command strokeWidth={1.75} />
        </Button>
      ) : null}
      <NotificationsPopover initialUnread={unread} />
      <Menu.Root>
        <Menu.Trigger className="pressable rounded-full outline-none focus-visible:ring-2 focus-visible:ring-secondary-container" aria-label="Account menu">
          <Avatar name={user.name} size={32} />
        </Menu.Trigger>
        <Menu.Content align="end" className="min-w-56">
          <div className="px-2.5 py-2">
            <p className="text-label truncate text-primary">{user.name}</p>
            <p className="text-body-sm truncate text-on-surface-variant">{user.email}</p>
            <p className="text-overline mt-1 text-secondary-container">{user.role.replace("_", " ")}</p>
          </div>
          <Menu.Separator />
          <Menu.Item onClick={() => router.push(surface === "app" ? "/app/settings/profile" : "/portal/account")}>
            <UserRound strokeWidth={1.75} /> Profile
          </Menu.Item>
          <Menu.Item
            onClick={async () => {
              const r = await signOut({});
              if (r.ok) {
                router.replace(r.data.next);
                router.refresh();
              }
            }}
          >
            <LogOut strokeWidth={1.75} /> Sign out
          </Menu.Item>
          <Menu.Item
            onClick={async () => {
              const r = await signOut({ everywhere: true });
              if (r.ok) {
                router.replace(r.data.next);
                router.refresh();
              }
            }}
          >
            <Timer strokeWidth={1.75} /> Sign out everywhere
          </Menu.Item>
        </Menu.Content>
      </Menu.Root>
      <Bell className="hidden" aria-hidden />
      {surface === "app" ? <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} /> : null}
    </header>
  );
}

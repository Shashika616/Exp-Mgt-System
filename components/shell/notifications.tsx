"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { fetchNotifications, markRead } from "@/lib/actions/notifications";
import { Button } from "@/components/ui/button";
import { Popover } from "@/components/ui/menu";
import { relativeTime } from "@/lib/utils";
import { cn } from "@/lib/utils";

type N = { id: string; kind: string; title: string; body: string | null; href: string | null; readAt: string | null; createdAt: string };

/** FR-NT-03 - bell with unread count, mark read. */
export function NotificationsPopover({ initialUnread }: { initialUnread: number }) {
  const [unread, setUnread] = useState(initialUnread);
  const [items, setItems] = useState<N[] | null>(null);
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const load = useCallback(async () => {
    const r = await fetchNotifications({});
    if (r.ok) {
      setItems(r.data.rows);
      setUnread(r.data.unread);
    }
  }, []);
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => void load(), 0);
    return () => clearTimeout(t);
  }, [open, load]);
  useEffect(() => {
    const every = Number(process.env.NEXT_PUBLIC_NOTIFICATIONS_POLL_MS ?? 60_000) || 0;
    if (every <= 0) return; // toggled off
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, Math.max(15_000, every));
    return () => clearInterval(id);
  }, [load]);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger className="pressable relative inline-flex size-9 items-center justify-center rounded-md text-primary outline-none hover:bg-surface-container focus-visible:ring-2 focus-visible:ring-secondary-container" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
        <Bell className="size-5" strokeWidth={1.75} aria-hidden />
        {unread > 0 ? <span className="tabular absolute -right-0.5 -top-0.5 min-w-4 rounded-full bg-secondary-container px-1 text-center text-[10px] font-semibold leading-4 text-on-secondary">{unread > 99 ? "99+" : unread}</span> : null}
      </Popover.Trigger>
      <Popover.Content align="end" className="w-[360px] max-w-[calc(100vw-32px)] p-0">
        <div className="flex items-center justify-between px-3 py-2">
          <p className="text-label">Notifications</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await markRead({ ids: "all" });
              setItems((xs) => xs?.map((x) => ({ ...x, readAt: x.readAt ?? new Date().toISOString() })) ?? null);
              setUnread(0);
            }}
            disabled={!unread}
          >
            <CheckCheck strokeWidth={1.75} /> Mark all read
          </Button>
        </div>
        <ul className="max-h-[420px] divide-y divide-outline-variant/40 overflow-y-auto border-t border-outline-variant/40" aria-live="polite">
          {items === null ? (
            <li className="px-3 py-6 text-center text-body-sm text-on-surface-variant">Loading…</li>
          ) : items.length === 0 ? (
            <li className="px-3 py-8 text-center text-body-sm text-on-surface-variant">You&apos;re all caught up.</li>
          ) : (
            items.map((n) => (
              <li key={n.id}>
                <Link
                  href={n.href ?? "#"}
                  onClick={async () => {
                    setOpen(false);
                    if (!n.readAt) {
                      await markRead({ ids: [n.id] });
                      setUnread((u) => Math.max(0, u - 1));
                    }
                    router.refresh();
                  }}
                  className={cn("block px-3 py-2.5 hover:bg-surface-container-low", !n.readAt && "bg-primary-fixed/30")}
                >
                  <div className="flex items-start gap-2">
                    {!n.readAt ? <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-secondary-container" aria-label="Unread" /> : <span className="mt-1.5 size-1.5 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md truncate text-primary">{n.title}</p>
                      {n.body ? <p className="text-body-sm line-clamp-2 text-on-surface-variant">{n.body}</p> : null}
                      <p className="text-body-sm mt-0.5 text-on-surface-variant">{relativeTime(n.createdAt)}</p>
                    </div>
                  </div>
                </Link>
              </li>
            ))
          )}
        </ul>
      </Popover.Content>
    </Popover.Root>
  );
}

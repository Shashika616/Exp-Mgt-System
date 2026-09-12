"use client";
import { useEffect, useRef } from "react";

/**
 * architecture.md §8: realtime on the ticket detail, behind one hook with two implementations:
 *  - poll: fetches /api/tickets/[id]/version every NEXT_PUBLIC_REALTIME_POLL_MS (default 15 s) while the tab is
 *    visible — portable fallback with no long-lived connections. Prefer `supabase` in production: push-based and
 *    free of function invocations.
 *  - supabase: Supabase Realtime postgres_changes with a short-lived access token from /api/realtime/token
 *    (token stays in memory; refresh tokens never leave the httpOnly cookie)
 * `onChange` fires when the ticket changed; the page then re-fetches via router.refresh().
 */
export function useTicketLive(ticketId: string, onChange: () => void, provider: "poll" | "supabase" = "poll") {
  const last = useRef<string | null>(null);
  useEffect(() => {
    let stopped = false;
    let cleanup = () => {};
    if (provider === "supabase") {
      (async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const res = await fetch("/api/realtime/token");
        if (!res.ok || stopped) return;
        const { url, anonKey, token } = (await res.json()) as { url: string; anonKey: string; token: string };
        const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        client.realtime.setAuth(token);
        const channel = client
          .channel(`ticket:${ticketId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` }, onChange)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `ticket_id=eq.${ticketId}` }, onChange)
          .subscribe();
        cleanup = () => void client.removeChannel(channel);
      })();
      return () => {
        stopped = true;
        cleanup();
      };
    }
    const tick = async () => {
      if (stopped || document.visibilityState !== "visible") return;
      try {
        const res = await fetch(`/api/tickets/${ticketId}/version`, { cache: "no-store" });
        if (!res.ok) return;
        const { fingerprint } = (await res.json()) as { fingerprint: string };
        if (last.current && last.current !== fingerprint) onChange();
        last.current = fingerprint;
      } catch {
        /* offline — try again next tick */
      }
    };
    void tick();
    const interval = Math.max(5000, Number(process.env.NEXT_PUBLIC_REALTIME_POLL_MS ?? 15000) || 15000);
    const id = setInterval(tick, interval);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [ticketId, onChange, provider]);
}

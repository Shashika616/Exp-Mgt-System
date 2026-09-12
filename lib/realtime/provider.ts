"use client";
import { useEffect } from "react";

/**
 * architecture.md §8: realtime on the ticket detail. Two implementations behind one hook:
 *  - sse: EventSource to /api/tickets/[id]/events (Postgres polling inside the stream; portable, no vendor)
 *  - supabase: Supabase Realtime postgres_changes with a short-lived access token from /api/realtime/token
 *    (the token stays in memory; refresh tokens never leave the httpOnly cookie)
 * The callback fires when the ticket changed; the page re-fetches via router.refresh().
 */
export function useTicketLive(ticketId: string, onChange: () => void, provider: "sse" | "supabase" = "sse") {
  useEffect(() => {
    let stop = () => {};
    if (provider === "supabase") {
      let cancelled = false;
      (async () => {
        const { createClient } = await import("@supabase/supabase-js");
        const res = await fetch("/api/realtime/token");
        if (!res.ok || cancelled) return;
        const { url, anonKey, token } = (await res.json()) as { url: string; anonKey: string; token: string };
        const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
        client.realtime.setAuth(token);
        const channel = client
          .channel(`ticket:${ticketId}`)
          .on("postgres_changes", { event: "*", schema: "public", table: "tickets", filter: `id=eq.${ticketId}` }, onChange)
          .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments", filter: `ticket_id=eq.${ticketId}` }, onChange)
          .subscribe();
        stop = () => {
          void client.removeChannel(channel);
        };
      })();
      return () => {
        cancelled = true;
        stop();
      };
    }
    let es: EventSource | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const connect = () => {
      if (document.visibilityState !== "visible") return;
      es = new EventSource(`/api/tickets/${ticketId}/events`);
      es.addEventListener("change", onChange);
      es.onerror = () => {
        es?.close();
        es = null;
        timer = setTimeout(connect, 5000);
      };
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible" && !es) connect();
      if (document.visibilityState !== "visible") {
        es?.close();
        es = null;
      }
    };
    connect();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      es?.close();
      if (timer) clearTimeout(timer);
    };
  }, [ticketId, onChange, provider]);
}

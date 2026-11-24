"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { newerTotals, type Totals } from "@/lib/claims";
import { createClient } from "@/lib/supabase/client";

const LiveTotalsContext = createContext<(itemId: string) => Totals | undefined>(() => undefined);

/**
 * Keeps claim totals for one list up to date. Subscribes to Realtime changes
 * on item_claim_totals and items for this list; the database's RLS decides
 * which events this person may receive (an owner gets no totals events on
 * their own list). Only used where the viewer is allowed to see totals.
 */
export function LiveTotalsProvider({
  listId,
  initial,
  children,
}: {
  listId: string;
  initial: Totals[];
  children: ReactNode;
}) {
  const router = useRouter();
  const [live, setLive] = useState<Record<string, Totals>>({});
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const supabase = createClient();
    let channel: RealtimeChannel | undefined;
    let cancelled = false;

    // Items changed (added or edited by the owner): re-render from the server.
    const refreshSoon = () => {
      clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => router.refresh(), 300);
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (cancelled) return;
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      channel = supabase
        .channel(`list-${listId}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "item_claim_totals", filter: `list_id=eq.${listId}` },
          (payload) => {
            const row = payload.new as Partial<Totals>;
            if (!row?.item_id || row.updated_at === undefined) return;
            setLive((prev) => ({ ...prev, [row.item_id!]: row as Totals }));
          },
        )
        .on("postgres_changes", { event: "*", schema: "public", table: "items", filter: `list_id=eq.${listId}` }, refreshSoon)
        // Changes made between the server render and this subscription being
        // ready (or while reconnecting) would be missed, so catch up once
        // Realtime confirms it's attached to the database.
        .on("system", {}, (payload: { extension?: string; status?: string }) => {
          if (payload.extension === "postgres_changes" && payload.status === "ok") refreshSoon();
        })
        .subscribe();
    })();

    // Members don't get Realtime events for removed items (RLS hides them),
    // so catch up whenever the page comes back into view.
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearTimeout(refreshTimer.current);
      document.removeEventListener("visibilitychange", onVisible);
      if (channel) supabase.removeChannel(channel);
    };
  }, [listId, router]);

  const lookup = useMemo(() => {
    const fromServer = Object.fromEntries(initial.map((t) => [t.item_id, t]));
    return (itemId: string) => newerTotals(fromServer[itemId], live[itemId]);
  }, [initial, live]);

  return <LiveTotalsContext.Provider value={lookup}>{children}</LiveTotalsContext.Provider>;
}

export function useTotals(itemId: string) {
  return useContext(LiveTotalsContext)(itemId);
}

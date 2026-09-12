"use client";
import { useState, useTransition } from "react";
import { listTicketsAction } from "@/lib/actions/tickets";
import { Button } from "@/components/ui/button";
import type { TicketFilter, TicketListRow } from "@/lib/dal/tickets";
import { TicketList, type Column } from "./ticket-list";

/** Keyset "Load more" on top of the server-rendered first page. */
export function TicketListClient({ initial, nextCursor, filter, columns, compact, selectable }: { initial: TicketListRow[]; nextCursor: string | null; filter: TicketFilter; columns: Column[]; compact: boolean; selectable: boolean }) {
  const [rows, setRows] = useState(initial);
  const [cursor, setCursor] = useState(nextCursor);
  const [pending, start] = useTransition();
  return (
    <>
      <TicketList rows={rows} columns={columns} compact={compact} selectable={selectable} />
      {cursor ? (
        <div className="mt-4 flex justify-center">
          <Button
            variant="outline"
            loading={pending}
            onClick={() =>
              start(async () => {
                const r = await listTicketsAction({ ...filter, cursor, limit: 50 } as Parameters<typeof listTicketsAction>[0]);
                if (r.ok) {
                  setRows((xs) => [...xs, ...(r.data.rows as TicketListRow[])]);
                  setCursor(r.data.nextCursor);
                }
              })
            }
          >
            Load more
          </Button>
        </div>
      ) : null}
    </>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { useState } from "react";
import { Input, NativeSelect } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PortalFilters({ scope, q, contacts, contact }: { scope: string; q: string; contacts: { id: string; name: string }[]; contact: string }) {
  const router = useRouter();
  const [query, setQuery] = useState(q);
  const go = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ scope, ...(q ? { q } : {}), ...(contact ? { contact } : {}), ...patch });
    for (const [k, v] of Object.entries(patch)) if (!v) p.delete(k);
    router.push(`/portal?${p}`);
  };
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-md border border-outline-variant p-0.5" role="tablist" aria-label="Filter">
        {[["open", "Open"], ["resolved", "Resolved"], ["all", "All"]].map(([v, l]) => (
          <button key={v} role="tab" aria-selected={scope === v} onClick={() => go({ scope: v! })} className={cn("pressable h-10 rounded-[3px] px-4 text-label text-on-surface-variant", scope === v && "bg-primary-container text-on-primary")}>{l}</button>
        ))}
      </div>
      <form className="relative flex-1 min-w-48" onSubmit={(e) => { e.preventDefault(); go({ q: query }); }}>
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-on-surface-variant" strokeWidth={1.75} aria-hidden />
        <Input touch value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by key or subject" className="pl-9" aria-label="Search requests" />
      </form>
      {contacts.length ? (
        <NativeSelect aria-label="Contact" className="h-11 w-52" value={contact} onChange={(e) => go({ contact: e.target.value })}>
          <option value="">Everyone in my organisation</option>
          {contacts.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
        </NativeSelect>
      ) : null}
    </div>
  );
}

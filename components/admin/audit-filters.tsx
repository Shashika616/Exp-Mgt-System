"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function AuditFilters({ action, actor }: { action: string; actor: string }) {
  const router = useRouter();
  const [a, setA] = useState(action);
  const [u, setU] = useState(actor);
  return (
    <form className="mb-4 flex flex-wrap gap-2" onSubmit={(e) => { e.preventDefault(); const q = new URLSearchParams(); if (a) q.set("action", a); if (u) q.set("actor", u); router.push(`/app/admin/audit?${q}`); }}>
      <Input value={a} onChange={(e) => setA(e.target.value)} placeholder="Action (e.g. settings.updated)" className="h-9 w-64" aria-label="Action" />
      <Input value={u} onChange={(e) => setU(e.target.value)} placeholder="Actor email" className="h-9 w-56" aria-label="Actor" />
      <Button type="submit" size="sm" variant="outline" className="h-9">Filter</Button>
      {(action || actor) ? <Button type="button" size="sm" variant="ghost" className="h-9" onClick={() => router.push("/app/admin/audit")}>Clear</Button> : null}
    </form>
  );
}

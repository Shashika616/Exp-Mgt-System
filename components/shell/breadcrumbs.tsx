"use client";
import { useEffect } from "react";
import { useBreadcrumbs } from "./app-shell";
import type { Crumb } from "./topbar";

/** Server pages render <Breadcrumbs items=[...]/> to set the top bar trail (wayfinding, design.md §8.4). */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  const ctx = useBreadcrumbs();
  const key = JSON.stringify(items);
  useEffect(() => {
    ctx?.setCrumbs(JSON.parse(key) as Crumb[]);
  }, [key, ctx]);
  return null;
}

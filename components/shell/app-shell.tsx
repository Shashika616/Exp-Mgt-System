"use client";
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { Topbar, type Crumb } from "./topbar";

const CrumbCtx = createContext<{ setCrumbs: (c: Crumb[]) => void } | null>(null);

/** Content column offset by the sidebar width; pages set breadcrumbs through <Breadcrumbs/>. */
export function AppShellClient({ children, user, unread, timer }: { children: ReactNode; user: { name: string; email: string; role: string }; unread: number; timer: { key: string; startedAt: string } | null }) {
  const [crumbs, setCrumbs] = useState<Crumb[]>([{ label: "Dashboard" }]);
  const ctx = useMemo(() => ({ setCrumbs }), []);
  return (
    <CrumbCtx.Provider value={ctx}>
      <div className="flex min-h-dvh flex-col pb-16 transition-[padding] duration-200 ease-out motion-reduce:transition-none md:pb-0 md:pl-[var(--sidebar-current,var(--sidebar-width))]">
        <Topbar crumbs={crumbs} user={user} unread={unread} timer={timer} />
        <main id="main" className="mx-auto w-full max-w-[1400px] flex-1 px-page py-6">
          {children}
        </main>
      </div>
    </CrumbCtx.Provider>
  );
}

export function useBreadcrumbs() {
  return useContext(CrumbCtx);
}

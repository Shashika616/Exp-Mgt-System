"use client";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { fadeReduced, springToast } from "@/lib/design/motion";
import { cn } from "@/lib/utils";

/** docs/design.md §7.9 — bottom-right, inverse surface, 6 s, Undo when reversible, aria-live polite. */
export type Toast = { id: number; title: string; body?: string; tone?: "default" | "success" | "error"; undo?: () => void | Promise<void>; actionLabel?: string };
type Ctx = { toast: (t: Omit<Toast, "id">) => number; dismiss: (id: number) => void };
const ToastCtx = createContext<Ctx | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([]);
  const counter = useRef(0);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const reduced = useReducedMotion();
  const dismiss = useCallback((id: number) => {
    setItems((xs) => xs.filter((x) => x.id !== id));
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
  }, []);
  const toast = useCallback(
    (t: Omit<Toast, "id">) => {
      const id = ++counter.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      timers.current.set(id, setTimeout(() => dismiss(id), t.undo ? 8000 : 6000));
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastCtx.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[360px] max-w-[calc(100vw-32px)] flex-col gap-2" aria-live="polite" aria-relevant="additions">
        <AnimatePresence initial={false}>
          {items.map((t) => (
            <m.div
              key={t.id}
              layout
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: 40 }}
              transition={reduced ? fadeReduced : springToast}
              className={cn("pointer-events-auto rounded-md bg-inverse-surface px-4 py-3 text-inverse-on-surface shadow-[var(--shadow-2)]", t.tone === "success" && "border-l-4 border-success-border", t.tone === "error" && "border-l-4 border-error")}
              role="status"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label text-inverse-on-surface">{t.title}</p>
                  {t.body ? <p className="text-body-sm mt-1 text-inverse-on-surface/80">{t.body}</p> : null}
                </div>
                {t.undo ? (
                  <button
                    type="button"
                    className="pressable shrink-0 rounded-sm px-2 py-1 text-label text-secondary-fixed-dim hover:bg-white/10"
                    onClick={async () => {
                      dismiss(t.id);
                      await t.undo?.();
                    }}
                  >
                    {t.actionLabel ?? "Undo"}
                  </button>
                ) : (
                  <button type="button" className="pressable shrink-0 rounded-sm px-2 py-1 text-label text-inverse-on-surface/70 hover:bg-white/10" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                    ×
                  </button>
                )}
              </div>
            </m.div>
          ))}
        </AnimatePresence>
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): Ctx {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error("useToast outside ToastProvider");
  return ctx;
}

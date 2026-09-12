"use client";
import { AnimatePresence, m, useReducedMotion } from "motion/react";
import { X } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { fadeReduced, springDefault, springSheet } from "@/lib/design/motion";
import { cn } from "@/lib/utils";
import { Button } from "./button";

/**
 * Sheet (right drawer / bottom sheet on mobile) and Dialog (destructive confirmation), docs/design.md §7.6–§7.7.
 * Built on `motion` so open/close springs are interruptible; Esc closes; focus returns to the trigger.
 * Materialise, don't fade: opacity + scale + blur animate together (§4).
 */
const FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

function useOverlay(open: boolean, onClose: () => void) {
  const panel = useRef<HTMLDivElement>(null);
  const restore = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement as HTMLElement | null;
    const el = panel.current;
    const first = el?.querySelector<HTMLElement>("[data-autofocus]") ?? el?.querySelector<HTMLElement>(FOCUSABLE);
    (first ?? el)?.focus({ preventScroll: true });
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
      if (e.key === "Tab" && el) {
        const items = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((x) => x.offsetParent !== null);
        if (items.length === 0) return;
        const firstItem = items[0]!;
        const last = items[items.length - 1]!;
        if (e.shiftKey && document.activeElement === firstItem) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          firstItem.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      restore.current?.focus({ preventScroll: true });
    };
  }, [open, onClose]);
  return panel;
}

const OverlayCtx = createContext<{ close: () => void; titleId: string } | null>(null);

export function Sheet({
  open,
  onClose,
  title,
  description,
  side = "right",
  width = 480,
  children,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  side?: "right" | "bottom";
  width?: 480 | 560 | 720;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}) {
  const reduced = useReducedMotion();
  const close = useCallback(() => onClose(), [onClose]);
  const panel = useOverlay(open, close);
  const titleId = useId();
  if (typeof document === "undefined") return null;
  const transition = reduced ? fadeReduced : springSheet;
  const isBottom = side === "bottom";
  return createPortal(
    <AnimatePresence>
      {open ? (
        <OverlayCtx.Provider value={{ close, titleId }}>
          <m.div key="scrim" className="fixed inset-0 z-40 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} onClick={close} aria-hidden />
          <m.div
            key="panel"
            ref={panel}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            className={cn(
              "material-sheet fixed z-50 flex flex-col shadow-[var(--shadow-3)] outline-none",
              isBottom ? "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl" : "inset-y-0 right-0 h-dvh max-w-full",
              className,
            )}
            style={isBottom ? undefined : { width }}
            initial={reduced ? { opacity: 0 } : isBottom ? { y: "100%", opacity: 1 } : { x: "100%", opacity: 1 }}
            animate={reduced ? { opacity: 1 } : { x: 0, y: 0, opacity: 1 }}
            exit={reduced ? { opacity: 0 } : isBottom ? { y: "100%" } : { x: "100%" }}
            transition={transition}
            drag={isBottom && !reduced ? "y" : false}
            dragConstraints={{ top: 0 }}
            dragElastic={{ top: 0.08, bottom: 0.6 }}
            onDragEnd={(_, info) => {
              // Commit vs cancel by velocity sign (apple-design §6): a downward flick dismisses.
              if (info.velocity.y > 400 || (info.velocity.y >= 0 && info.offset.y > 120)) close();
            }}
          >
            {isBottom ? <div className="mx-auto mt-2 h-1.5 w-10 shrink-0 rounded-full bg-outline-variant" aria-hidden /> : null}
            <header className="flex items-start justify-between gap-4 px-6 pb-3 pt-5">
              <div className="min-w-0">
                <h2 id={titleId} className="text-headline-md truncate">
                  {title}
                </h2>
                {description ? <p className="text-body-sm mt-1 text-on-surface-variant">{description}</p> : null}
              </div>
              <Button variant="ghost" size="icon-sm" onClick={close} aria-label="Close">
                <X strokeWidth={1.75} />
              </Button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-2">{children}</div>
            {footer ? <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/60 px-6 py-4">{footer}</footer> : null}
          </m.div>
        </OverlayCtx.Provider>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

/** Confirmation dialog — destructive/irreversible actions only (design.md §7.7). Safe action is the default. */
export function ConfirmDialog({
  open,
  onClose,
  title,
  body,
  confirmLabel,
  onConfirm,
  loading,
  destructive = true,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body?: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  loading?: boolean;
  destructive?: boolean;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  const close = useCallback(() => onClose(), [onClose]);
  const panel = useOverlay(open, close);
  const titleId = useId();
  if (typeof document === "undefined") return null;
  const transition = reduced ? fadeReduced : springDefault;
  return createPortal(
    <AnimatePresence>
      {open ? (
        <>
          <m.div key="scrim" className="fixed inset-0 z-40 bg-[var(--scrim)]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={transition} onClick={close} aria-hidden />
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <m.div
              ref={panel}
              role="alertdialog"
              aria-modal="true"
              aria-labelledby={titleId}
              tabIndex={-1}
              className="w-full max-w-[420px] rounded-lg bg-surface-container-lowest p-6 shadow-[var(--shadow-3)] outline-none"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
              transition={transition}
            >
              <h2 id={titleId} className="text-headline-md">
                {title}
              </h2>
              {body ? <div className="text-body-md mt-2 text-on-surface-variant">{body}</div> : null}
              {children ? <div className="mt-4">{children}</div> : null}
              <div className="mt-6 flex justify-end gap-2">
                <Button variant="outline" onClick={close} data-autofocus>
                  Keep
                </Button>
                <Button variant={destructive ? "destructive" : "primary"} onClick={() => void onConfirm()} loading={loading}>
                  {confirmLabel}
                </Button>
              </div>
            </m.div>
          </div>
        </>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
}

export function useOverlayClose() {
  return useContext(OverlayCtx);
}

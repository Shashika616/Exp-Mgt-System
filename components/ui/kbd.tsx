export function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-sm border border-outline-variant bg-surface-container-lowest px-1 font-heading text-[11px] text-on-surface-variant">{children}</kbd>;
}

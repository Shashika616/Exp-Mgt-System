import { cn, initials } from "@/lib/utils";

// docs/design.md §7.10 - initials on primary-fixed; orgs are rounded-md to distinguish from people.
export function Avatar({ name, size = 32, kind = "person", className }: { name: string; size?: 24 | 32 | 40; kind?: "person" | "org"; className?: string }) {
  const cls = size === 24 ? "size-6 text-[10px]" : size === 32 ? "size-8 text-[12px]" : "size-10 text-[14px]";
  return (
    <span
      className={cn("inline-flex shrink-0 select-none items-center justify-center bg-primary-fixed font-heading font-600 font-semibold text-on-primary-fixed", kind === "org" ? "rounded-md" : "rounded-full", cls, className)}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

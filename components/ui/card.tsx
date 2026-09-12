import { cn } from "@/lib/utils";

// docs/design.md §7.4 — level-1 shadow; `accent` (4px blue top rule) only on the single primary card of a screen.
export function Card({ accent, className, children, as: Tag = "section", ...props }: { accent?: boolean; className?: string; children: React.ReactNode; as?: "section" | "div" | "article" | "aside" } & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag className={cn("soft-lift rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-6", accent && "border-t-4 border-t-secondary-container", className)} {...props}>
      {children}
    </Tag>
  );
}

export function CardHeader({ title, eyebrow, action, className }: { title: React.ReactNode; eyebrow?: string; action?: React.ReactNode; className?: string }) {
  return (
    <header className={cn("mb-4 flex items-start justify-between gap-4", className)}>
      <div>
        {eyebrow ? <p className="text-overline text-secondary">{eyebrow}</p> : null}
        <h2 className="text-headline-sm mt-1">{title}</h2>
      </div>
      {action}
    </header>
  );
}

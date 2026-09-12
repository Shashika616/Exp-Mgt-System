import { type ReactNode, useId } from "react";
import { cn } from "@/lib/utils";

/** Label above, inline error on blur (design.md §7.2). Pass `error` from react-hook-form's fieldState. */
export function Field({ label, hint, error, required, children, className, id: idProp }: { label: string; hint?: string; error?: string | null; required?: boolean; children: (props: { id: string; "aria-invalid": boolean; "aria-describedby"?: string }) => ReactNode; className?: string; id?: string }) {
  const auto = useId();
  const id = idProp ?? auto;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={id} className="text-label text-primary">
        {label}
        {required ? (
          <span className="ml-0.5 text-error" aria-hidden>
            *
          </span>
        ) : null}
      </label>
      {children({ id, "aria-invalid": !!error, "aria-describedby": describedBy })}
      {error ? (
        <p id={`${id}-error`} className="text-body-sm text-error" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-body-sm text-on-surface-variant">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

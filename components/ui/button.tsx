"use client";
import type { VariantProps } from "class-variance-authority";
import { buttonVariants } from "./button-variants";
import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(({ className, variant, size, loading, children, disabled, type = "button", ...props }, ref) => (
  <button ref={ref} type={type} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
    {loading ? (
      <span className="grid place-items-center [grid-template-areas:'a']">
        <span className="invisible flex items-center gap-2 [grid-area:a]">{children}</span>
        <LoaderCircle className="animate-spin [grid-area:a]" aria-hidden />
      </span>
    ) : (
      children
    )}
  </button>
));
Button.displayName = "Button";

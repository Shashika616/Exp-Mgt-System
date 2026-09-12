"use client";
import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// docs/design.md §7.2
const base =
  "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-3 text-body-md text-primary placeholder:text-outline focus:border-secondary-container focus:outline-none focus:ring-[3px] focus:ring-secondary-container/25 disabled:bg-surface-container-low disabled:text-on-surface-variant aria-[invalid=true]:border-error aria-[invalid=true]:focus:ring-error/20";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { touch?: boolean }>(({ className, touch, ...props }, ref) => (
  <input ref={ref} className={cn(base, touch ? "h-11" : "h-10", className)} {...props} />
));
Input.displayName = "Input";

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(base, "min-h-24 resize-y py-2 leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const NativeSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(({ className, children, ...props }, ref) => (
  <select ref={ref} className={cn(base, "h-10 appearance-none bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2216%22 height=%2216%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%2344474e%22 stroke-width=%221.75%22 stroke-linecap=%22round%22 stroke-linejoin=%22round%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:16px] bg-[right_10px_center] bg-no-repeat pr-9", className)} {...props}>
    {children}
  </select>
));
NativeSelect.displayName = "NativeSelect";

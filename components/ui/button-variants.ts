import { cva } from "class-variance-authority";

// docs/design.md §7.1 - one primary per view; feedback on pointer-down (.pressable); loading keeps width.
export const buttonVariants = cva(
  "pressable inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-label select-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary: "bg-primary-container text-on-primary hover:bg-secondary-container",
        outline: "border-[1.5px] border-primary-container text-primary-container hover:bg-surface-container-low",
        ghost: "text-primary hover:bg-surface-container",
        destructive: "bg-error-container text-on-error-container hover:bg-error hover:text-on-error",
        link: "text-secondary underline-offset-4 hover:text-primary hover:underline h-auto px-0",
        subtle: "bg-surface-container text-primary hover:bg-surface-container-high",
      },
      size: {
        sm: "h-8 px-3 text-[12px] [&_svg]:size-4",
        md: "h-10 px-4 [&_svg]:size-4",
        lg: "h-11 px-5 text-[14px] [&_svg]:size-5",
        icon: "size-9 [&_svg]:size-5",
        "icon-sm": "size-8 [&_svg]:size-4",
      },
    },
    defaultVariants: { variant: "primary", size: "md" },
  },
);


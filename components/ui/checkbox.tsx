"use client";
import { Checkbox as BaseCheckbox } from "@base-ui/react/checkbox";
import { Switch as BaseSwitch } from "@base-ui/react/switch";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export function Checkbox({ className, ...props }: React.ComponentProps<typeof BaseCheckbox.Root>) {
  return (
    // 24×24 hit target (WCAG 2.2 target-size) around a 16px box
    <BaseCheckbox.Root className={cn("pressable group flex size-6 shrink-0 items-center justify-center rounded-sm", className)} {...props}>
      <span className="flex size-4 items-center justify-center rounded-sm border border-outline-variant bg-surface-container-lowest group-data-[checked]:border-primary-container group-data-[checked]:bg-primary-container">
        <BaseCheckbox.Indicator className="text-on-primary">
          <Check className="size-3" strokeWidth={3} aria-hidden />
        </BaseCheckbox.Indicator>
      </span>
    </BaseCheckbox.Root>
  );
}

export function Switch({ className, ...props }: React.ComponentProps<typeof BaseSwitch.Root>) {
  return (
    <BaseSwitch.Root className={cn("relative h-6 w-10 rounded-full bg-outline-variant transition-colors data-[checked]:bg-primary-container", className)} {...props}>
      <BaseSwitch.Thumb className="block size-5 translate-x-0.5 rounded-full bg-white shadow transition-transform duration-150 data-[checked]:translate-x-[18px]" />
    </BaseSwitch.Root>
  );
}

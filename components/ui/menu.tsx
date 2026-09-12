"use client";
import { Menu as BaseMenu } from "@base-ui/react/menu";
import { Popover as BasePopover } from "@base-ui/react/popover";
import { Tooltip as BaseTooltip } from "@base-ui/react/tooltip";
import { Tabs as BaseTabs } from "@base-ui/react/tabs";
import { cn } from "@/lib/utils";

/** Base UI menus/popovers restyled per docs/design.md §4 (solid surface, level-2 shadow, origin at trigger). */
const popupClass =
  "z-50 min-w-44 rounded-lg border border-outline-variant/40 bg-surface-container-lowest p-1 shadow-[var(--shadow-2)] outline-none origin-[var(--transform-origin)] transition-[transform,opacity] duration-150 ease-out data-[starting-style]:scale-95 data-[starting-style]:opacity-0 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 motion-reduce:transition-opacity";

export const Menu = {
  Root: BaseMenu.Root,
  Trigger: BaseMenu.Trigger,
  Content: ({ children, className, align = "start", side = "bottom" }: { children: React.ReactNode; className?: string; align?: "start" | "end" | "center"; side?: "bottom" | "top" | "left" | "right" }) => (
    <BaseMenu.Portal>
      <BaseMenu.Positioner align={align} side={side} sideOffset={6} className="z-50">
        <BaseMenu.Popup className={cn(popupClass, className)}>{children}</BaseMenu.Popup>
      </BaseMenu.Positioner>
    </BaseMenu.Portal>
  ),
  Item: ({ className, ...props }: React.ComponentProps<typeof BaseMenu.Item>) => (
    <BaseMenu.Item className={cn("flex h-9 cursor-default select-none items-center gap-2 rounded-md px-2.5 text-body-md text-primary outline-none data-[highlighted]:bg-surface-container-low data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-on-surface-variant", className)} {...props} />
  ),
  Separator: () => <BaseMenu.Separator className="my-1 h-px bg-outline-variant/60" />,
  Label: ({ children }: { children: React.ReactNode }) => <BaseMenu.GroupLabel className="px-2.5 py-1.5 text-overline text-on-surface-variant">{children}</BaseMenu.GroupLabel>,
  Group: BaseMenu.Group,
};

export const Popover = {
  Root: BasePopover.Root,
  Trigger: BasePopover.Trigger,
  Content: ({ children, className, align = "start", side = "bottom" }: { children: React.ReactNode; className?: string; align?: "start" | "end" | "center"; side?: "bottom" | "top" | "left" | "right" }) => (
    <BasePopover.Portal>
      <BasePopover.Positioner align={align} side={side} sideOffset={6} className="z-50">
        <BasePopover.Popup className={cn(popupClass, "p-3", className)}>{children}</BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  ),
  Close: BasePopover.Close,
};

export function Tooltip({ content, children }: { content: React.ReactNode; children: React.ReactElement }) {
  return (
    <BaseTooltip.Root>
      <BaseTooltip.Trigger render={children} />
      <BaseTooltip.Portal>
        <BaseTooltip.Positioner sideOffset={6} className="z-50">
          <BaseTooltip.Popup className="rounded-md bg-inverse-surface px-2 py-1 text-[12px] font-medium text-inverse-on-surface shadow-[var(--shadow-2)] transition-opacity duration-150 data-[starting-style]:opacity-0 data-[ending-style]:opacity-0">{content}</BaseTooltip.Popup>
        </BaseTooltip.Positioner>
      </BaseTooltip.Portal>
    </BaseTooltip.Root>
  );
}

export const TooltipProvider = BaseTooltip.Provider;

/** Tabs with the blue active underline (design.md §1.4 rule 2). */
export const Tabs = {
  Root: BaseTabs.Root,
  List: ({ className, children, ...props }: React.ComponentProps<typeof BaseTabs.List>) => (
    <BaseTabs.List className={cn("relative flex gap-1 border-b border-outline-variant/60", className)} {...props}>
      {children}
      <BaseTabs.Indicator className="absolute bottom-0 left-0 h-0.5 w-[var(--active-tab-width)] translate-x-[var(--active-tab-left)] bg-secondary-container transition-[translate,width] duration-200 ease-out motion-reduce:transition-none" />
    </BaseTabs.List>
  ),
  Tab: ({ className, ...props }: React.ComponentProps<typeof BaseTabs.Tab>) => (
    <BaseTabs.Tab className={cn("pressable -mb-px flex h-10 items-center gap-2 border-b-2 border-transparent px-3 text-label text-on-surface-variant outline-none hover:text-primary data-[selected]:text-secondary [&_svg]:size-4", className)} {...props} />
  ),
  Panel: BaseTabs.Panel,
};

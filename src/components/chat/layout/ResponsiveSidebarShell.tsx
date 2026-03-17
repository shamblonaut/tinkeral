import type { ReactNode } from "react";

import { X } from "lucide-react";

import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface ResponsiveSidebarShellProps {
  title: string;
  isOpen: boolean;
  isDesktop: boolean;
  onToggleDesktop: () => void;
  onOpenChange: (open: boolean) => void;
  desktopWidthClassName?: string;
  mobileWidthClassName?: string;
  closeButtonAriaLabel?: string;
  closeButtonScreenReaderLabel?: string;
  content: ReactNode;
}

export function ResponsiveSidebarShell({
  title,
  isOpen,
  isDesktop,
  onToggleDesktop,
  onOpenChange,
  desktopWidthClassName = "w-80",
  mobileWidthClassName = "w-80",
  closeButtonAriaLabel,
  closeButtonScreenReaderLabel = "Close sidebar",
  content,
}: ResponsiveSidebarShellProps) {
  if (isDesktop) {
    if (!isOpen) return null;

    return (
      <div
        className={cn(
          "bg-background animate-in slide-in-from-left flex h-full shrink-0 flex-col border-r transition-all duration-300 ease-in-out",
          desktopWidthClassName,
        )}
      >
        <div className="flex h-14 items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleDesktop}
            className="h-8 w-8"
            aria-label={closeButtonAriaLabel}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{closeButtonScreenReaderLabel}</span>
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">{content}</div>
      </div>
    );
  }

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className={cn("p-0", mobileWidthClassName)}
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">{title}</SheetTitle>
        <div className="flex h-14 items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">{title}</h2>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label={closeButtonAriaLabel}
            >
              <X className="text-muted-foreground h-4 w-4" />
              <span className="sr-only">{closeButtonScreenReaderLabel}</span>
            </Button>
          </SheetClose>
        </div>
        <div className="flex-1 overflow-hidden">{content}</div>
      </SheetContent>
    </Sheet>
  );
}

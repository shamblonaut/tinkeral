import { Settings, X } from "lucide-react";

import {
  Button,
  Sheet,
  SheetClose,
  SheetContent,
  SheetTitle,
} from "@/components/ui";
import { useMediaQuery } from "@/hooks";
import { cn } from "@/lib/utils";
import { useUIStore } from "@/stores";

import { FunctionSidebarList } from "./FunctionSidebarList";

export function FunctionSidebar() {
  const { isSidebarOpen, toggleSidebar, setSidebarOpen, openModal } =
    useUIStore();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const Content = (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <FunctionSidebarList
        className="min-h-0 flex-1"
        onSelect={!isDesktop ? () => setSidebarOpen(false) : undefined}
      />
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 p-6"
          onClick={() => openModal("settings")}
          aria-label="Open settings"
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );

  if (isDesktop) {
    if (!isSidebarOpen) return null;

    return (
      <div
        className={cn(
          "bg-background animate-in slide-in-from-left flex h-full w-80 shrink-0 flex-col border-r transition-all duration-300 ease-in-out",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Functions</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSidebar}
            className="h-8 w-8"
            aria-label="Close function sidebar"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close sidebar</span>
          </Button>
        </div>
        <div className="flex-1 overflow-hidden">{Content}</div>
      </div>
    );
  }

  return (
    <Sheet open={isSidebarOpen} onOpenChange={setSidebarOpen}>
      <SheetContent
        side="left"
        className="w-[85vw] max-w-80 p-0"
        showCloseButton={false}
      >
        <SheetTitle className="sr-only">Functions</SheetTitle>
        <div className="flex h-14 items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Functions</h2>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              aria-label="Close function sidebar"
            >
              <X className="text-muted-foreground h-4 w-4" />
              <span className="sr-only">Close sidebar</span>
            </Button>
          </SheetClose>
        </div>
        <div className="flex-1 overflow-hidden">{Content}</div>
      </SheetContent>
    </Sheet>
  );
}

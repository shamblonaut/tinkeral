import { Settings } from "lucide-react";

import { ResponsiveSidebarShell } from "@/features/chat";
import { Button } from "@/shared/components/ui";
import { useMediaQuery } from "@/shared/hooks";
import { useUIStore } from "@/shared/store/ui";

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

  return (
    <ResponsiveSidebarShell
      title="Functions"
      isOpen={isSidebarOpen}
      isDesktop={isDesktop}
      onToggleDesktop={toggleSidebar}
      onOpenChange={setSidebarOpen}
      desktopWidthClassName="w-80"
      mobileWidthClassName="w-[85vw] max-w-80"
      closeButtonAriaLabel="Close function sidebar"
      content={Content}
    />
  );
}

import { Settings } from "lucide-react";

import { Button } from "@/components/ui";
import { useMediaQuery } from "@/hooks";
import { useUIStore } from "@/stores";

import { ConversationList } from "../conversation/ConversationList";
import { ResponsiveSidebarShell } from "./ResponsiveSidebarShell";

export function ConversationSidebar() {
  const { isSidebarOpen, toggleSidebar, setSidebarOpen, openModal } =
    useUIStore();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const Content = (
    <div className="flex h-full flex-1 flex-col overflow-hidden">
      <ConversationList
        className="min-h-0 flex-1"
        onSelect={!isDesktop ? () => setSidebarOpen(false) : undefined}
      />
      <div className="border-t p-4">
        <Button
          variant="ghost"
          className="w-full justify-start gap-2 p-6"
          onClick={() => openModal("settings")}
        >
          <Settings className="h-4 w-4" />
          Settings
        </Button>
      </div>
    </div>
  );

  return (
    <ResponsiveSidebarShell
      title="Conversations"
      isOpen={isSidebarOpen}
      isDesktop={isDesktop}
      onToggleDesktop={toggleSidebar}
      onOpenChange={setSidebarOpen}
      desktopWidthClassName="w-80"
      mobileWidthClassName="w-80"
      content={Content}
    />
  );
}

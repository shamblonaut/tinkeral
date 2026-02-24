import { PanelLeft, Settings2 } from "lucide-react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

interface ChatHeaderProps {
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isChatSettingsOpen: boolean;
  toggleChatSettings: () => void;
}

export function ChatHeader({
  isSidebarOpen,
  toggleSidebar,
  isChatSettingsOpen,
  toggleChatSettings,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className={cn(
            "h-8 w-8",
            isSidebarOpen && "bg-accent text-accent-foreground",
          )}
        >
          <PanelLeft className="h-4 w-4" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <h1 className="text-xl font-bold">🧩 Tinkeral</h1>
      </div>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleChatSettings}
          className={cn(
            "h-8 w-8",
            isChatSettingsOpen && "bg-accent text-accent-foreground",
          )}
        >
          <Settings2 className="h-4 w-4" />
          <span className="sr-only">Toggle chat settings</span>
        </Button>
      </div>
    </header>
  );
}

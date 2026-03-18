import { Braces, MessageSquareText, PanelLeft, Settings2 } from "lucide-react";

import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";
import type { PlatformView } from "@/shared/store/ui";

interface ChatHeaderProps {
  platformView: PlatformView;
  setPlatformView: (view: PlatformView) => void;
  showFunctionsView?: boolean;
  attachedFunctionCount?: number;
  isSidebarOpen: boolean;
  toggleSidebar: () => void;
  isSettingsOpen: boolean;
  toggleSettings: () => void;
  showSettingsToggle?: boolean;
}

export function ChatHeader({
  platformView,
  setPlatformView,
  showFunctionsView = true,
  attachedFunctionCount = 0,
  isSidebarOpen,
  toggleSidebar,
  isSettingsOpen,
  toggleSettings,
  showSettingsToggle = true,
}: ChatHeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between gap-1 border-b px-3 md:gap-2 md:px-4">
      <div className="flex items-center gap-2 md:gap-4">
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
        <h1 className="flex items-center gap-2">
          <span className="text-xl">🧩</span>
          <span className="hidden text-2xl font-bold md:block">Tinkeral</span>
        </h1>

        <div className="bg-muted flex items-center gap-1 rounded-md p-1">
          <Button
            variant="ghost"
            size="sm"
            className={cn(
              "h-7 gap-1.5 px-2 text-xs",
              platformView === "chat" && "bg-background text-foreground",
            )}
            onClick={() => setPlatformView("chat")}
            aria-pressed={platformView === "chat"}
            aria-label="Switch to chat view"
          >
            <MessageSquareText className="h-3.5 w-3.5" />
            <span className="hidden md:inline">Chat</span>
          </Button>
          {showFunctionsView && (
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "h-7 gap-1.5 px-2 text-xs",
                platformView === "functions" && "bg-background text-foreground",
              )}
              onClick={() => setPlatformView("functions")}
              aria-pressed={platformView === "functions"}
              aria-label="Switch to functions view"
            >
              <Braces className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Functions</span>
            </Button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {showFunctionsView && platformView === "chat" && (
          <div className="text-muted-foreground flex items-center gap-1 rounded-md border px-2 py-1 text-xs">
            <Braces className="h-3.5 w-3.5" />
            <span>{attachedFunctionCount}</span>
          </div>
        )}
        {showSettingsToggle && (
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSettings}
            className={cn(
              "h-8 w-8",
              isSettingsOpen && "bg-accent text-accent-foreground",
            )}
            title="Toggle settings"
          >
            <Settings2 className="h-4 w-4" />
            <span className="sr-only">Toggle settings</span>
          </Button>
        )}
      </div>
    </header>
  );
}

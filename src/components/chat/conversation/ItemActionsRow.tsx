import type { MouseEvent, ReactNode } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

export interface ItemAction {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: (event: MouseEvent<HTMLButtonElement>) => void;
  destructive?: boolean;
}

interface ItemActionsRowProps {
  actions: ItemAction[];
}

export function ItemActionsRow({ actions }: ItemActionsRowProps) {
  return (
    <div className="grid grid-cols-3 gap-1">
      {actions.map((action) => (
        <Button
          key={action.id}
          variant="ghost"
          size="sm"
          className={cn(
            "h-8 gap-1.5 px-0 text-[11px] font-normal",
            action.destructive &&
              "text-destructive hover:text-destructive hover:bg-destructive/10",
          )}
          onClick={action.onClick}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}

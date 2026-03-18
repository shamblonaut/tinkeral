import { MoreVertical } from "lucide-react";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

import { Button } from "@/shared/components/ui";
import { cn } from "@/shared/lib/utils";

interface ExpandableSelectableItemCardProps {
  isActive: boolean;
  isExpanded: boolean;
  onClick: () => void;
  onToggleExpanded: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLDivElement>) => void;
  onDoubleClick?: () => void;
  role?: "button";
  tabIndex?: number;
  ariaPressed?: boolean;
  ariaLabel?: string;
  leadingContent: ReactNode;
  titleContent: ReactNode;
  metadataContent: ReactNode;
  detailsContent: ReactNode;
  expandButtonContainerClassName?: string;
  expandButtonAriaLabel?: string;
  expandButtonAriaExpanded?: boolean;
}

export function ExpandableSelectableItemCard({
  isActive,
  isExpanded,
  onClick,
  onToggleExpanded,
  onKeyDown,
  onDoubleClick,
  role,
  tabIndex,
  ariaPressed,
  ariaLabel,
  leadingContent,
  titleContent,
  metadataContent,
  detailsContent,
  expandButtonContainerClassName = "opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100",
  expandButtonAriaLabel = "Toggle details",
  expandButtonAriaExpanded,
}: ExpandableSelectableItemCardProps) {
  const handleToggleExpanded = (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    onToggleExpanded();
  };

  return (
    <div
      onClick={onClick}
      onKeyDown={onKeyDown}
      onDoubleClick={onDoubleClick}
      role={role}
      tabIndex={tabIndex}
      aria-pressed={ariaPressed}
      aria-label={ariaLabel}
      className={cn(
        "group relative flex cursor-pointer flex-col gap-1 rounded-lg p-3 transition-colors",
        isActive
          ? "bg-accent text-accent-foreground"
          : "hover:bg-muted/50 text-muted-foreground hover:text-foreground",
        isExpanded && "bg-muted/30 hover:bg-muted/40",
      )}
    >
      <div className="flex items-center gap-2 pr-8">
        {leadingContent}
        {titleContent}
      </div>

      <div className="flex items-center justify-between gap-2 pl-6 text-[11px]">
        {metadataContent}
      </div>

      <div
        className={cn("absolute top-2 right-2", expandButtonContainerClassName)}
      >
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-7 w-7 transition-all",
            isActive ? "hover:bg-accent-foreground/10" : "hover:bg-accent",
            isExpanded && "bg-accent rotate-90",
          )}
          aria-label={expandButtonAriaLabel}
          aria-expanded={expandButtonAriaExpanded}
          onClick={handleToggleExpanded}
        >
          <MoreVertical className="h-3.5 w-3.5" />
          <span className="sr-only">{expandButtonAriaLabel}</span>
        </Button>
      </div>

      <div
        className={cn(
          "grid transition-[grid-template-rows,opacity,margin] duration-200 ease-in-out",
          isExpanded
            ? "mt-2 grid-rows-[1fr] opacity-100"
            : "mt-0 grid-rows-[0fr] opacity-0",
        )}
      >
        {detailsContent}
      </div>
    </div>
  );
}

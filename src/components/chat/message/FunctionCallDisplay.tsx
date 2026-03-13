import { ChevronDown, ChevronUp, Wrench } from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FunctionCall } from "@/types";

interface FunctionCallDisplayProps {
  functionCall: FunctionCall;
}

function safeFormatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function FunctionCallDisplay({
  functionCall,
}: FunctionCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const formattedArgs = useMemo(
    () => safeFormatJson(functionCall.arguments),
    [functionCall.arguments],
  );
  const shouldCollapse = formattedArgs.length > 320;

  return (
    <div className="border-primary/30 bg-primary/5 w-full rounded-xl border p-3 shadow-sm">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-foreground flex items-center gap-2">
          <Wrench className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">Function Call</span>
        </div>
        <span className="bg-primary/10 text-primary rounded-md px-2 py-1 font-mono text-xs">
          {functionCall.name}
        </span>
      </div>

      <div className="bg-background border-border/60 overflow-hidden rounded-md border">
        <div className="text-muted-foreground border-border/60 border-b px-3 py-2 text-xs font-medium">
          Arguments
        </div>
        <pre
          className={cn(
            "overflow-auto px-3 py-2 font-mono text-xs leading-relaxed",
            shouldCollapse && !isExpanded && "max-h-28",
          )}
        >
          {formattedArgs}
        </pre>
      </div>

      {shouldCollapse && (
        <Button
          variant="ghost"
          size="sm"
          className="mt-2 h-7 text-xs"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="mr-1 h-3.5 w-3.5" />
              Collapse
            </>
          ) : (
            <>
              <ChevronDown className="mr-1 h-3.5 w-3.5" />
              Expand
            </>
          )}
        </Button>
      )}
    </div>
  );
}

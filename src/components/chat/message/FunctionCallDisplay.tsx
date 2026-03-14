import {
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  OctagonX,
  Wrench,
} from "lucide-react";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";
import type { FunctionCall, FunctionResult } from "@/types";

type FunctionExecutionStatus =
  | "requested"
  | "executing"
  | "completed"
  | "failed"
  | "cancelled";

interface FunctionCallDisplayProps {
  functionCall: FunctionCall;
  functionResult?: FunctionResult;
  status?: FunctionExecutionStatus;
  onCancel?: () => void;
}

function safeFormatJson(value: unknown): string {
  try {
    const result = JSON.stringify(value, null, 2);
    return result ?? String(value);
  } catch {
    return String(value);
  }
}

export function FunctionCallDisplay({
  functionCall,
  functionResult,
  status = "requested",
  onCancel,
}: FunctionCallDisplayProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const formattedArgs = useMemo(
    () => safeFormatJson(functionCall.arguments),
    [functionCall.arguments],
  );
  const formattedResult = useMemo(
    () => safeFormatJson(functionResult?.result),
    [functionResult?.result],
  );
  const shouldCollapse = formattedArgs.length > 320;
  const shouldCollapseResult = formattedResult.length > 320;
  const isExecuting = status === "executing";

  const statusLabel =
    status === "executing"
      ? "Executing"
      : status === "completed"
        ? "Completed"
        : status === "failed"
          ? "Failed"
          : status === "cancelled"
            ? "Cancelled"
            : "Requested";

  return (
    <div
      className={cn(
        "w-full rounded-xl border p-3 shadow-sm transition-all",
        isExecuting
          ? "border-primary/50 bg-primary/10 animate-in fade-in"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-foreground flex items-center gap-2">
          <Wrench className="text-primary h-4 w-4" />
          <span className="text-sm font-semibold">Function Call</span>
        </div>
        <span className="bg-primary/10 text-primary rounded-md px-2 py-1 font-mono text-xs">
          {functionCall.name}
        </span>
      </div>

      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs",
            status === "failed"
              ? "bg-destructive/10 text-destructive"
              : status === "cancelled"
                ? "bg-muted text-muted-foreground"
                : status === "completed"
                  ? "bg-primary/10 text-primary"
                  : "bg-primary/10 text-primary",
          )}
        >
          {isExecuting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : status === "completed" ? (
            <CheckCircle2 className="h-3.5 w-3.5" />
          ) : status === "cancelled" ? (
            <OctagonX className="h-3.5 w-3.5" />
          ) : null}
          {statusLabel}
        </span>

        {isExecuting && onCancel && (
          <Button
            variant="ghost"
            size="sm"
            className="text-destructive h-7 px-2 text-xs"
            onClick={onCancel}
          >
            Cancel
          </Button>
        )}
      </div>

      <div className="bg-background border-border/60 overflow-hidden rounded-md border">
        <div className="text-muted-foreground border-border/60 border-b px-3 py-2 text-xs font-medium">
          Request (Arguments)
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

      {functionResult && (
        <div className="mt-2">
          <div className="bg-background border-border/60 overflow-hidden rounded-md border">
            <div className="text-muted-foreground border-border/60 border-b px-3 py-2 text-xs font-medium">
              Response
            </div>

            {functionResult.error && (
              <div className="text-destructive border-border/60 border-b px-3 py-2 text-xs">
                {functionResult.error}
              </div>
            )}

            <pre
              className={cn(
                "overflow-auto px-3 py-2 font-mono text-xs leading-relaxed",
                shouldCollapseResult && !isResultExpanded && "max-h-28",
              )}
            >
              {formattedResult}
            </pre>
          </div>

          <div className="mt-2 flex items-center justify-between gap-2">
            {typeof functionResult.executionTime === "number" ? (
              <span className="bg-background border-border/60 rounded-md border px-2 py-1 text-xs">
                {functionResult.executionTime.toFixed(0)} ms
              </span>
            ) : (
              <span />
            )}

            {shouldCollapseResult && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => setIsResultExpanded((current) => !current)}
              >
                {isResultExpanded ? (
                  <>
                    <ChevronUp className="mr-1 h-3.5 w-3.5" />
                    Collapse response
                  </>
                ) : (
                  <>
                    <ChevronDown className="mr-1 h-3.5 w-3.5" />
                    Expand response
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

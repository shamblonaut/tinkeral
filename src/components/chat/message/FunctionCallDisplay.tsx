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

const MAX_RENDERED_JSON_CHARS = 100 * 1024;

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
  const isExecuting = status === "executing";
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(isExecuting);
  const [isArgsExpanded, setIsArgsExpanded] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);

  const formattedArgs = useMemo(
    () => safeFormatJson(functionCall.arguments),
    [functionCall.arguments],
  );
  const rawFormattedResult = useMemo(
    () => safeFormatJson(functionResult?.result),
    [functionResult?.result],
  );
  const isResultTruncated = rawFormattedResult.length > MAX_RENDERED_JSON_CHARS;
  const formattedResult = isResultTruncated
    ? `${rawFormattedResult.slice(0, MAX_RENDERED_JSON_CHARS)}\n… output truncated for display`
    : rawFormattedResult;

  const shouldCollapseArgs = formattedArgs.length > 320;
  const shouldCollapseResult = formattedResult.length > 320;

  // Auto-expand when executing, auto-collapse when completed
  const [prevStatus, setPrevStatus] = useState(status);
  if (status !== prevStatus) {
    if (status === "executing") {
      setIsDetailsExpanded(true);
    } else if (status === "completed" || status === "failed") {
      setIsDetailsExpanded(false);
    }
    setPrevStatus(status);
  }

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
        "my-3 w-full rounded-lg border px-3 py-2 shadow-sm transition-all",
        isExecuting
          ? "border-primary/50 bg-primary/10 animate-in fade-in"
          : "border-primary/20 bg-black/5 dark:bg-white/5",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 overflow-hidden">
          <div className="bg-primary/10 rounded-md p-1">
            <Wrench className="text-primary h-3.5 w-3.5 shrink-0" />
          </div>
          <span className="text-primary font-mono text-xs font-semibold">
            {functionCall.name}
          </span>
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium tracking-wider uppercase",
              status === "failed"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/20 text-primary",
            )}
          >
            {isExecuting ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : status === "completed" ? (
              <CheckCircle2 className="h-3 w-3" />
            ) : status === "cancelled" ? (
              <OctagonX className="h-3 w-3" />
            ) : null}
            {statusLabel}
          </span>
        </div>

        <div className="flex items-center gap-1">
          {isExecuting && onCancel && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:bg-destructive/20 h-6 px-2 text-[10px]"
              onClick={onCancel}
            >
              Cancel
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="hover:bg-primary/20 h-6 w-6 p-0"
            onClick={() => setIsDetailsExpanded((prev) => !prev)}
            aria-label={
              isDetailsExpanded
                ? "Collapse function details"
                : "Expand function details"
            }
            title={
              isDetailsExpanded
                ? "Collapse function details"
                : "Expand function details"
            }
          >
            {isDetailsExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {isDetailsExpanded && (
        <div className="animate-in fade-in slide-in-from-top-1 mt-2 space-y-2 duration-200">
          <div className="bg-muted/30 border-border/40 overflow-hidden rounded-md border">
            <div className="text-muted-foreground border-border/40 border-b px-2 py-1 text-[9px] font-medium tracking-tight uppercase">
              Arguments
            </div>
            <pre
              className={cn(
                "overflow-auto px-2 py-1.5 font-mono text-[10px] leading-relaxed",
                shouldCollapseArgs && !isArgsExpanded && "max-h-24",
              )}
            >
              {formattedArgs}
            </pre>
            {shouldCollapseArgs && (
              <button
                onClick={() => setIsArgsExpanded(!isArgsExpanded)}
                className="text-primary hover:bg-muted/50 border-t-border/40 w-full border-t py-0.5 text-[9px] font-medium transition-colors"
              >
                {isArgsExpanded ? "Show less" : "Show all arguments"}
              </button>
            )}
          </div>

          {functionResult && (
            <div className="bg-muted/30 border-border/40 overflow-hidden rounded-md border">
              <div className="text-muted-foreground border-border/40 flex items-center justify-between border-b px-2 py-1 text-[9px] font-medium tracking-tight uppercase">
                <span>Result</span>
                {typeof functionResult.executionTime === "number" && (
                  <span className="lowercase opacity-70">
                    {functionResult.executionTime.toFixed(0)}ms
                  </span>
                )}
              </div>

              {functionResult.error && (
                <div className="text-destructive border-border/40 border-b px-2 py-1.5 text-[10px]">
                  {functionResult.error}
                </div>
              )}

              {isResultTruncated && (
                <div className="text-muted-foreground border-border/40 border-b px-2 py-1 text-[9px]">
                  Output truncated for UI performance.
                </div>
              )}

              <pre
                className={cn(
                  "overflow-auto px-2 py-1.5 font-mono text-[10px] leading-relaxed",
                  shouldCollapseResult && !isResultExpanded && "max-h-24",
                )}
              >
                {formattedResult}
              </pre>
              {shouldCollapseResult && (
                <button
                  onClick={() => setIsResultExpanded(!isResultExpanded)}
                  className="text-primary hover:bg-muted/50 border-t-border/40 w-full border-t py-0.5 text-[9px] font-medium transition-colors"
                >
                  {isResultExpanded ? "Show less" : "Show all output"}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

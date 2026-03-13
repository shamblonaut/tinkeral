import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useMemo, useState } from "react";

import { Button } from "@/components/ui";
import { oneDark, oneLight, SyntaxHighlighter } from "@/lib/syntaxHighlighter";
import { cn } from "@/lib/utils";
import type { FunctionResult } from "@/types";

interface FunctionResultDisplayProps {
  functionResult: FunctionResult;
}

function safeFormatJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export function FunctionResultDisplay({
  functionResult,
}: FunctionResultDisplayProps) {
  const { resolvedTheme } = useTheme();
  const [isExpanded, setIsExpanded] = useState(false);
  const hasError = Boolean(functionResult.error);
  const formattedResult = useMemo(
    () => safeFormatJson(functionResult.result),
    [functionResult.result],
  );
  const shouldCollapse = formattedResult.length > 500;

  return (
    <div
      className={cn(
        "w-full rounded-xl border p-3 shadow-sm",
        hasError
          ? "border-destructive/40 bg-destructive/5"
          : "border-primary/30 bg-primary/5",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="text-foreground flex items-center gap-2">
          {hasError ? (
            <AlertTriangle className="text-destructive h-4 w-4" />
          ) : (
            <CheckCircle2 className="text-primary h-4 w-4" />
          )}
          <span className="text-sm font-semibold">Function Result</span>
        </div>
        <span className="bg-background border-border/60 rounded-md border px-2 py-1 font-mono text-xs">
          {functionResult.name}
        </span>
      </div>

      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span
          className={cn(
            "rounded-md px-2 py-1",
            hasError
              ? "bg-destructive/10 text-destructive"
              : "bg-primary/10 text-primary",
          )}
        >
          {hasError ? "Error" : "Success"}
        </span>
        {typeof functionResult.executionTime === "number" && (
          <span className="bg-background border-border/60 rounded-md border px-2 py-1">
            {functionResult.executionTime.toFixed(0)} ms
          </span>
        )}
      </div>

      {functionResult.error && (
        <div className="text-destructive mb-2 rounded-md border border-current/20 bg-current/5 px-3 py-2 text-xs">
          {functionResult.error}
        </div>
      )}

      <div
        className={cn(
          "bg-background border-border/60 overflow-hidden rounded-md border",
          shouldCollapse && !isExpanded && "max-h-52",
        )}
      >
        <div className="text-muted-foreground border-border/60 border-b px-3 py-2 text-xs font-medium">
          Output
        </div>
        <SyntaxHighlighter
          style={resolvedTheme === "light" ? oneLight : oneDark}
          language="json"
          customStyle={{
            margin: 0,
            padding: "0.75rem",
            fontSize: "0.75rem",
            borderRadius: 0,
          }}
          codeTagProps={{
            style: {
              fontFamily: "var(--font-mono)",
            },
          }}
        >
          {formattedResult}
        </SyntaxHighlighter>
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

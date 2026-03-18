import { ArrowDown, ArrowDownUp, ArrowUp, Brain, Zap } from "lucide-react";
import { memo } from "react";

import { cn } from "@/shared/lib/utils";
import type { TokenUsage } from "@/shared/types/conversation";

interface TokenUsageDisplayProps {
  usage?: TokenUsage;
  role: "user" | "model" | "assistant" | "system";
  contentLength: number;
  className?: string;
}

export const TokenUsageDisplay = memo(function TokenUsageDisplay({
  usage,
  role,
  contentLength,
  className,
}: TokenUsageDisplayProps) {
  const isUser = role === "user";
  const hasInput = !!usage?.inputTokens;
  const hasOutput = !!usage?.outputTokens;
  const showSplitTokens = hasInput || hasOutput;

  const tooltipContent = isUser
    ? hasInput
      ? "Input tokens sent to the model"
      : "Approximate tokens sent to the model"
    : showSplitTokens
      ? hasOutput
        ? "Output tokens received from the model"
        : "Approximate tokens received from the model"
      : usage?.totalTokens
        ? "Total tokens in this turn"
        : "Approximate total tokens in this turn";

  if (isUser) {
    if (!showSplitTokens) return null;

    return (
      <div
        className={cn(
          "text-muted-foreground flex items-center gap-1 text-[10px]",
          className,
        )}
        title={tooltipContent}
      >
        <ArrowUp className="h-2.5 w-2.5" />
        <span>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {!hasInput && "*"}
              {usage?.inputTokens ?? Math.ceil(contentLength / 4)}
            </div>
            {!!usage?.cachedTokens && (
              <div
                className="flex items-center gap-1 opacity-70"
                title={`${usage.cachedTokens} tokens from cache`}
              >
                <span>•</span>
                <Zap className="h-2.5 w-2.5" />
                <span>{usage.cachedTokens}</span>
              </div>
            )}
          </div>
        </span>
      </div>
    );
  }

  // Model response
  return (
    <div
      className={cn(
        "text-muted-foreground flex items-center gap-1 text-[10px]",
        className,
      )}
      title={tooltipContent}
    >
      <span>•</span>
      {showSplitTokens ? (
        <ArrowDown className="h-2.5 w-2.5" />
      ) : (
        <ArrowDownUp className="h-2.5 w-2.5" />
      )}
      <span>
        {showSplitTokens ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              {!hasOutput && "*"}
              {usage?.outputTokens ?? Math.ceil(contentLength / 4)}
            </div>
            {!!usage?.thinkingTokens && (
              <div
                className="flex items-center gap-1 opacity-70"
                title={`${usage.thinkingTokens} thinking tokens consumed by the model`}
              >
                <span>•</span>
                <Brain className="h-2.5 w-2.5" />
                <span>{usage.thinkingTokens}</span>
              </div>
            )}
          </div>
        ) : (
          <>
            {!usage?.totalTokens && "*"}
            {usage?.totalTokens ?? Math.ceil(contentLength / 4)}
          </>
        )}
      </span>
    </div>
  );
});

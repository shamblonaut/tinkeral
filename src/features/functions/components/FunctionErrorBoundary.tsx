import { AlertTriangle } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/shared/components/ui";

interface FunctionErrorBoundaryProps {
  children: ReactNode;
  title?: string;
  description?: string;
}

interface FunctionErrorBoundaryState {
  hasError: boolean;
}

export class FunctionErrorBoundary extends Component<
  FunctionErrorBoundaryProps,
  FunctionErrorBoundaryState
> {
  public state: FunctionErrorBoundaryState = {
    hasError: false,
  };

  public static getDerivedStateFromError(): FunctionErrorBoundaryState {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Function feature UI error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="bg-muted/40 border-border/60 flex w-full items-start gap-2 rounded-lg border p-3 text-sm">
          <AlertTriangle className="text-destructive mt-0.5 h-4 w-4 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium">
              {this.props.title || "Function component failed to render"}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {this.props.description ||
                "Reload the view or continue chatting while this section recovers."}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => this.setState({ hasError: false })}
          >
            Retry
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}

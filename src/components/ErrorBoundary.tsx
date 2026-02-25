import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-svh w-full flex-col items-center justify-center gap-4 p-8 text-center">
          <h1 className="font-heading text-2xl font-bold">
            Something went wrong
          </h1>
          <p className="text-muted-foreground w-full max-w-md">
            An unexpected error occurred in the application. You can try
            reloading the page to recover.
          </p>
          <div className="mt-4 flex gap-4">
            <Button onClick={() => window.location.reload()}>
              Reload Application
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                // Clear local storage as a last resort
                if (
                  window.confirm(
                    "This will clear all settings and conversations. Are you sure?",
                  )
                ) {
                  localStorage.clear();
                  indexedDB.deleteDatabase("TinkeralDB");
                  window.location.reload();
                }
              }}
            >
              Reset Data & Reload
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

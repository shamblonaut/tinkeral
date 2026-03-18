interface LoadingScreenProps {
  message?: string;
  progress?: number;
}

export function LoadingScreen({
  message = "Initializing...",
  progress = 0,
}: LoadingScreenProps) {
  return (
    <div className="bg-background flex h-svh w-full flex-col items-center justify-center overflow-hidden">
      {/* Background decoration */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div className="bg-primary/5 absolute -top-[10%] -left-[10%] h-[40%] w-[40%] animate-pulse rounded-full blur-[120px]" />
        <div className="bg-primary/5 absolute -right-[10%] -bottom-[10%] h-[40%] w-[40%] animate-pulse rounded-full blur-[120px] [animation-delay:2s]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8">
        {/* Logo/Icon Container */}
        <div className="relative">
          <div className="bg-primary/20 absolute inset-0 scale-150 animate-pulse rounded-full blur-xl" />
          <div className="bg-card relative flex h-20 w-20 items-center justify-center rounded-2xl border shadow-2xl">
            <span className="text-4xl">🧩</span>
          </div>
        </div>

        {/* Text content */}
        <div className="flex flex-col items-center gap-2">
          <h1 className="text-foreground text-2xl font-semibold tracking-tight">
            Tinkeral
          </h1>
          <p className="text-muted-foreground animate-pulse text-sm font-medium transition-all duration-500">
            {message}
          </p>
        </div>

        {/* Progress bar */}
        <div className="flex flex-col items-center gap-2">
          <div className="bg-secondary/50 relative h-1.5 w-56 overflow-hidden rounded-full border shadow-inner">
            <div
              className="bg-primary absolute inset-y-0 left-0 transition-all duration-1000 ease-[cubic-bezier(0.65,0,0.35,1)]"
              style={{
                width: `${Math.min(100, Math.max(0, progress))}%`,
              }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

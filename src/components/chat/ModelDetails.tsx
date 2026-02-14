import type { ModelInfo } from "@/types";

export function ModelDetails({ model }: { model: ModelInfo }) {
  return (
    <div className="space-y-4">
      <div>
        <h4 className="font-semibold">{model.name}</h4>
        <p className="text-muted-foreground text-xs">{model.id}</p>
      </div>
      {model.description && (
        <p className="text-muted-foreground text-sm">{model.description}</p>
      )}
      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground block font-medium">
            Context Window
          </span>
          {model.contextWindow.toLocaleString()} tokens
        </div>
        <div>
          <span className="text-muted-foreground block font-medium">
            Max Output
          </span>
          {model.maxOutputTokens.toLocaleString()} tokens
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-muted-foreground block text-xs font-medium">
          Capabilities
        </span>
        <div className="flex flex-wrap gap-1">
          {model.capabilities.streaming && (
            <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
              Streaming
            </span>
          )}
          {model.capabilities.vision && (
            <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
              Vision
            </span>
          )}
          {model.capabilities.functionCalling && (
            <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
              Functions
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

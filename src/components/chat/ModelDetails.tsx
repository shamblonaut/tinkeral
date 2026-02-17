import type { ModelInfo } from "@/types";

export function ModelDetails({ model }: { model: ModelInfo }) {
  const {
    imageInput,
    videoInput,
    audioInput,
    textGeneration,
    imageGeneration,
    videoGeneration,
    speechGeneration,
    systemInstruction,
    functionCalling,
    codeExecution,
    thinking,
  } = model.capabilities;

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <h4 className="font-semibold">{model.name}</h4>
          {model.stage !== "stable" && (
            <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-amber-500 uppercase">
              {model.stage}
            </span>
          )}
        </div>
        <p className="text-muted-foreground text-xs">{model.id}</p>
      </div>

      {model.description && (
        <p className="text-muted-foreground text-sm">{model.description}</p>
      )}

      <div className="grid grid-cols-2 gap-4 text-xs">
        <div>
          <span className="text-muted-foreground block font-medium">
            Context (Input)
          </span>
          {model.contextWindow.input.toLocaleString()}
        </div>
        <div>
          <span className="text-muted-foreground block font-medium">
            Max Output
          </span>
          {model.contextWindow.output.toLocaleString()}
        </div>
      </div>

      <div className="space-y-2">
        <span className="text-muted-foreground block text-xs font-medium">
          Capabilities
        </span>
        {(imageInput || videoInput || audioInput) && (
          <div className="flex flex-wrap gap-1">
            {imageInput && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                Vision
              </span>
            )}
            {videoInput && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                Video Analysis
              </span>
            )}
            {audioInput && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                Audio
              </span>
            )}
          </div>
        )}
        {(thinking ||
          systemInstruction ||
          functionCalling ||
          codeExecution) && (
          <div className="flex flex-wrap gap-1">
            {thinking && (
              <span className="rounded border border-blue-500/20 bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-500">
                Thinking
              </span>
            )}
            {systemInstruction && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                System Instructions
              </span>
            )}
            {functionCalling && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                Function Calling
              </span>
            )}
            {codeExecution && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                Code Execution
              </span>
            )}
          </div>
        )}
        {(textGeneration ||
          imageGeneration ||
          videoGeneration ||
          speechGeneration) && (
          <div className="flex flex-wrap gap-1">
            {textGeneration && (
              <span className="bg-secondary text-secondary-foreground rounded px-1.5 py-0.5 text-[10px] font-medium">
                Text Generation
              </span>
            )}
            {imageGeneration && (
              <span className="rounded border border-red-500/20 bg-red-500/10 px-1.5 py-0.5 text-[10px] font-medium text-red-500">
                Image Generation
              </span>
            )}
            {videoGeneration && (
              <span className="rounded border border-purple-500/20 bg-purple-500/10 px-1.5 py-0.5 text-[10px] font-medium text-purple-500">
                Video Generation
              </span>
            )}
            {speechGeneration && (
              <span className="rounded border border-green-500/20 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-medium text-green-500">
                Speech Generation
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

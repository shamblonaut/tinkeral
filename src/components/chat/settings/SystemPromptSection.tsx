import { Info } from "lucide-react";

import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Textarea,
} from "@/components/ui";

interface SystemPromptSectionProps {
  systemPrompt: string;
  setSystemPrompt: (prompt: string) => void;
  isDisabled: boolean;
}

export function SystemPromptSection({
  systemPrompt,
  setSystemPrompt,
  isDisabled,
}: SystemPromptSectionProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
            System Prompt
          </Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-4 w-4 cursor-help rounded-full p-0"
                tabIndex={-1}
              >
                <Info className="text-muted-foreground hover:text-foreground h-3.5 w-3.5" />
                <span className="sr-only">Info</span>
              </Button>
            </PopoverTrigger>
            <PopoverContent side="top" className="max-w-[200px] p-2">
              <p className="text-xs">
                Instructions for how the model should behave.
              </p>
            </PopoverContent>
          </Popover>
        </div>
        <span className="text-muted-foreground text-xs">
          *{Math.ceil(systemPrompt.length / 4)} tokens
        </span>
      </div>
      <Textarea
        placeholder="You are a helpful assistant..."
        value={systemPrompt}
        onChange={(e) => setSystemPrompt(e.target.value)}
        className="min-h-[100px] resize-y"
        disabled={isDisabled}
      />
    </div>
  );
}

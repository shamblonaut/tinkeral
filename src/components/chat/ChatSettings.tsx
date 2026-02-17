import { ModelSelector, ParameterControl } from "@/components/chat";
import {
  Button,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  ScrollArea,
} from "@/components/ui";
import { useMediaQuery } from "@/hooks";
import { getModelDefaultParameters } from "@/lib/models";
import { useConversationStore, useUIStore } from "@/stores";
import { DEFAULT_PARAMETERS } from "@/types";
import { RotateCcw, X } from "lucide-react";

export function ChatSettings() {
  const { isChatSettingsOpen, toggleChatSettings, setChatSettingsOpen } =
    useUIStore();
  const isDesktop = useMediaQuery("(min-width: 768px)");

  const activeConversationId = useConversationStore(
    (state) => state.activeConversationId,
  );

  const conversation = useConversationStore((state) =>
    state.conversations.find((c) => c.id === activeConversationId),
  );

  const setParameters = useConversationStore((state) => state.setParameters);
  // Use conversation parameters or defaults
  const parameters = conversation?.parameters || DEFAULT_PARAMETERS;
  const isDisabled = !conversation;
  const availableModels = useConversationStore(
    (state) => state.availableModels,
  );
  const activeModel = availableModels.find(
    (m) => m.id === conversation?.modelId,
  );

  const maxOutputTokens = activeModel?.contextWindow.output || 8192;

  const handleParamChange = (key: string, value: number) => {
    setParameters({ [key]: value });
  };

  const Content = (
    <div className="space-y-6 p-4">
      <div className="space-y-4">
        <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
          Model
        </h3>
        <ModelSelector />
      </div>

      <div className="bg-border h-px" />

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
            Parameters
          </h3>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-foreground h-6 w-6 p-4"
            onClick={() => {
              if (conversation) {
                setParameters(
                  getModelDefaultParameters(conversation.modelId),
                  "replace",
                );
              }
            }}
            disabled={isDisabled}
          >
            <RotateCcw className="h-3 w-3" />
            <span className="sr-only">Reset Parameters</span>
          </Button>
        </div>
        <ParameterControl
          id="temperature"
          label="Temperature"
          value={parameters.temperature}
          min={0}
          max={2}
          step={0.1}
          onChange={(val) => handleParamChange("temperature", val)}
          description="Controls randomness. Higher values make output more random, lower values more deterministic."
          disabled={isDisabled}
        />
        <ParameterControl
          id="topP"
          label="Top P"
          value={parameters.topP}
          min={0}
          max={1}
          step={0.01}
          onChange={(val) => handleParamChange("topP", val)}
          description="Tokens are selected from most probable to least until the sum of their probabilities equals the top-p value."
          disabled={isDisabled}
        />

        {/* Top K is Google specific usually, but good to have */}
        <ParameterControl
          id="topK"
          label="Top K"
          value={parameters.topK || 40}
          min={1}
          max={100}
          step={1}
          onChange={(val) => handleParamChange("topK", val)}
          description="Limits the next token selection to the K most likely tokens."
          disabled={isDisabled}
        />
        <ParameterControl
          id="maxTokens"
          label="Max Output Tokens"
          value={parameters.maxTokens}
          min={1}
          max={maxOutputTokens}
          step={1}
          onChange={(val) => handleParamChange("maxTokens", val)}
          description="The maximum number of tokens to generate in the response."
          disabled={isDisabled}
        />
      </div>
    </div>
  );

  if (isDesktop) {
    if (!isChatSettingsOpen) return null;
    return (
      <div className="bg-background flex h-full w-100 shrink-0 flex-col border-l transition-all duration-300 ease-in-out">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="text-sm font-semibold">Chat Settings</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleChatSettings}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close settings</span>
          </Button>
        </div>
        <ScrollArea className="flex-1">{Content}</ScrollArea>
      </div>
    );
  }

  return (
    <Drawer open={isChatSettingsOpen} onOpenChange={setChatSettingsOpen}>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader>
            <DrawerTitle>Chat Settings</DrawerTitle>
            <DrawerDescription>
              Configure model and generation parameters.
            </DrawerDescription>
          </DrawerHeader>
          <ScrollArea className="h-[60vh] pb-4">{Content}</ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

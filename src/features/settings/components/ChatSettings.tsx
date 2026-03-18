import { RotateCcw, X } from "lucide-react";
import { useEffect } from "react";

import features from "@/config/features";
import { useConversationStore } from "@/features/chat";
import { useFunctionsStore } from "@/features/functions";
import {
  Button,
  Checkbox,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  ScrollArea,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";
import { useMediaQuery } from "@/shared/hooks";
import { getModelDefaultParameters } from "@/shared/lib/models";
import { useUIStore } from "@/shared/store/ui";
import { DEFAULT_PARAMETERS, type FunctionCallingMode } from "@/shared/types";

import { ModelSelector } from "./ModelSelector";
import { ParameterControl } from "./ParameterControl";
import { SystemPromptSection } from "./SystemPromptSection";

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

  const systemPrompt = conversation?.systemPrompt || "";
  const setSystemPrompt = useConversationStore(
    (state) => state.setSystemPrompt,
  );
  const toggleFunctionAttachment = useConversationStore(
    (state) => state.toggleFunctionAttachment,
  );
  const setFunctionCallingMode = useConversationStore(
    (state) => state.setFunctionCallingMode,
  );
  const {
    functions,
    ensureFunctionsLoaded,
    isLoading: isLoadingFunctions,
  } = useFunctionsStore();
  const setPlatformView = useUIStore((state) => state.setPlatformView);
  const selectFunction = useUIStore((state) => state.selectFunction);

  useEffect(() => {
    if (features.functionCalling) {
      void ensureFunctionsLoaded();
    }
  }, [ensureFunctionsLoaded]);

  const maxOutputTokens = activeModel?.contextWindow.output || 8192;
  const supportsFunctionCalling =
    activeModel?.capabilities.functionCalling ?? false;
  const attachedFunctionIds = conversation?.functionIds || [];
  const functionCallingMode: FunctionCallingMode =
    conversation?.functionCallingMode || "AUTO";

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

      {activeModel?.capabilities.systemInstruction && (
        <>
          <SystemPromptSection
            systemPrompt={systemPrompt}
            setSystemPrompt={setSystemPrompt}
            isDisabled={isDisabled}
          />

          <div className="bg-border h-px" />
        </>
      )}

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

      {features.functionCalling && (
        <>
          <div className="bg-border h-px" />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-muted-foreground text-sm font-semibold tracking-wider uppercase">
                Functions
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => {
                  selectFunction(null);
                  setPlatformView("functions");
                }}
              >
                New
              </Button>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="function-calling-mode"
                className="text-muted-foreground text-xs font-medium"
              >
                Function Calling Mode
              </label>
              <Select
                value={functionCallingMode}
                onValueChange={(value) =>
                  void setFunctionCallingMode(value as FunctionCallingMode)
                }
                disabled={isDisabled || !supportsFunctionCalling}
              >
                <SelectTrigger id="function-calling-mode" className="w-full">
                  <SelectValue placeholder="Select mode" />
                </SelectTrigger>
                <SelectContent align="end">
                  <SelectItem value="AUTO">Auto</SelectItem>
                  <SelectItem value="ANY">Required</SelectItem>
                  <SelectItem value="NONE">None</SelectItem>
                </SelectContent>
              </Select>
              {!supportsFunctionCalling && (
                <p className="text-muted-foreground text-xs">
                  The selected model does not support function calling.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <p className="text-muted-foreground text-xs font-medium">
                Attached Functions
              </p>

              <div className="max-h-56 space-y-2 overflow-auto rounded-md border p-2">
                {isLoadingFunctions ? (
                  <p className="text-muted-foreground text-xs">Loading…</p>
                ) : functions.length === 0 ? (
                  <p className="text-muted-foreground text-xs">
                    No functions available yet.
                  </p>
                ) : (
                  functions.map((fn) => {
                    const isChecked = attachedFunctionIds.includes(fn.id);
                    return (
                      <label
                        key={fn.id}
                        className="hover:bg-muted/60 flex cursor-pointer items-start gap-2 rounded px-2 py-1.5"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={() =>
                            void toggleFunctionAttachment(fn.id)
                          }
                          disabled={isDisabled || !supportsFunctionCalling}
                          className="mt-0.5"
                        />
                        <span className="min-w-0 text-xs">
                          <span className="block truncate font-medium">
                            {fn.name}
                          </span>
                          <span className="text-muted-foreground block truncate text-[10px]">
                            {fn.description || "No description"}
                          </span>
                        </span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  if (isDesktop) {
    if (!isChatSettingsOpen) return null;
    return (
      <div className="bg-background flex h-full min-h-0 w-80 shrink-0 flex-col border-l transition-all duration-300 ease-in-out">
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
        <ScrollArea className="min-h-0 flex-1">{Content}</ScrollArea>
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

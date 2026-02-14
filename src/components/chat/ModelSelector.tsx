import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

import { ModelDetails } from "@/components/chat";
import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui";
import { useMediaQuery, useModelSelection } from "@/hooks";
import { cn } from "@/lib/utils";
import type { ModelInfo } from "@/types";

function ModelItem({
  model,
  isSelected,
  onSelect,
}: {
  model: ModelInfo;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <CommandItem
      key={model.id}
      value={model.id}
      onSelect={onSelect}
      className="cursor-pointer"
    >
      <Check
        className={cn("mr-2 h-4 w-4", isSelected ? "opacity-100" : "opacity-0")}
      />
      <div className="flex flex-col">
        <span>{model.name}</span>
        <span className="text-muted-foreground text-xs">{model.id}</span>
      </div>
    </CommandItem>
  );
}

function ModelSelectorDesktop() {
  const [open, setOpen] = useState(false);
  const [focusedModelId, setFocusedModelId] = useState<string>("");

  const { sortedModels, selectedModel, currentModelId, handleSelect } =
    useModelSelection(() => setOpen(false));

  const activeModelId = focusedModelId || currentModelId;
  const activeModel = sortedModels.find((m) => m.id === activeModelId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="hidden w-3xs justify-between truncate md:flex"
        >
          <p className="overflow-hidden text-ellipsis">
            {selectedModel ? selectedModel.name : currentModelId}
          </p>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-xl p-0" align="end">
        <div className="flex h-[300px]">
          <Command
            className="w-3xs rounded-r-none border-r"
            value={focusedModelId}
            onValueChange={setFocusedModelId}
          >
            <CommandInput placeholder="Search model..." />
            <CommandList>
              <CommandEmpty>No model found.</CommandEmpty>
              <CommandGroup>
                {sortedModels.map((model) => (
                  <ModelItem
                    key={model.id}
                    model={model}
                    isSelected={currentModelId === model.id}
                    onSelect={() => handleSelect(model.id)}
                  />
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
          <div className="bg-muted/30 flex-1 p-4">
            {activeModel ? (
              <ModelDetails model={activeModel} />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No model selected
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModelSelectorMobile() {
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const { sortedModels, selectedModel, currentModelId, handleSelect } =
    useModelSelection(() => {
      setOpen(false);
      setSearchQuery("");
    });

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="flex w-[32vw] min-w-40 justify-between"
        >
          <p className="overflow-hidden text-ellipsis">
            {selectedModel ? selectedModel.name : currentModelId}
          </p>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm">
          <DrawerHeader className="text-left">
            <DrawerTitle>Select Model</DrawerTitle>
            <DrawerDescription>
              Choose an AI model for your conversation.
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Command>
              <CommandInput
                placeholder="Search model..."
                value={searchQuery}
                onValueChange={setSearchQuery}
              />
              <CommandList>
                <CommandEmpty>No model found.</CommandEmpty>
                {!searchQuery && selectedModel && (
                  <div className="bg-muted/30 mx-1 my-2 flex rounded-md border p-2">
                    <Check className="m-2 h-4 w-4 shrink-0" />
                    <ModelDetails model={selectedModel} />
                  </div>
                )}
                <CommandGroup>
                  {sortedModels
                    .filter((model) => {
                      // If we are searching, show all models (so the selected one can be found)
                      // If we are NOT searching, hide the selected model (it's shown in the details card above)
                      if (searchQuery) return true;
                      return model.id !== currentModelId;
                    })
                    .map((model) => (
                      <ModelItem
                        key={model.id}
                        model={model}
                        isSelected={currentModelId === model.id}
                        onSelect={() => handleSelect(model.id)}
                      />
                    ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function ModelSelector() {
  const isDesktop = useMediaQuery("(min-width: 768px)");

  if (isDesktop) {
    return <ModelSelectorDesktop />;
  }

  return <ModelSelectorMobile />;
}

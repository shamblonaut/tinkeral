import { Check, ChevronsUpDown } from "lucide-react";
import { useState } from "react";

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
} from "@/shared/components/ui";
import { useMediaQuery } from "@/shared/hooks";
import { cn } from "@/shared/lib/utils";
import type { ModelInfo } from "@/shared/types";

import { useModelSelection } from "../hooks";
import { ModelDetails } from "./ModelDetails";

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

interface ModelListProps {
  models: ModelInfo[];
  currentModelId: string;
  onSelect: (id: string) => void;
  focusedModelId: string;
  setFocusedModelId: (id: string) => void;
  selectedModel?: ModelInfo | null;
  hideSelected?: boolean;
  className?: string;
}

function ModelList({
  models,
  currentModelId,
  onSelect,
  focusedModelId,
  setFocusedModelId,
  selectedModel,
  hideSelected = false,
  className,
}: ModelListProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const visibleModels = models.filter((m) => {
    if (hideSelected && !searchQuery && m.id === currentModelId) return false;
    return true;
  });

  const handleSearch = (query: string) => {
    setSearchQuery(query);

    if (!query) {
      const firstId = hideSelected
        ? models.find((m) => m.id !== currentModelId)?.id
        : models[0]?.id;
      setFocusedModelId(firstId || "");
    }
  };

  return (
    <Command
      className={cn("w-full", className)}
      value={focusedModelId}
      onValueChange={setFocusedModelId}
      shouldFilter={true}
    >
      <CommandInput
        placeholder="Search model..."
        value={searchQuery}
        onValueChange={handleSearch}
      />
      <CommandList key={searchQuery}>
        <CommandEmpty>No model found.</CommandEmpty>
        {!searchQuery && selectedModel && (
          <div className="bg-muted/30 mx-1 mt-2 mb-1 flex rounded-md border p-2">
            <Check className="m-2 h-4 w-4 shrink-0" />
            <ModelDetails model={selectedModel} />
          </div>
        )}
        <CommandGroup>
          {visibleModels.map((model) => (
            <ModelItem
              key={model.id}
              model={model}
              isSelected={currentModelId === model.id}
              onSelect={() => onSelect(model.id)}
            />
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  );
}

function ModelSelectorDesktop() {
  const [open, setOpen] = useState(false);
  const { models, selectedModel, currentModelId, handleSelect } =
    useModelSelection(() => setOpen(false));

  const [focusedId, setFocusedId] = useState(currentModelId);
  const activeModel = models.find(
    (m) => m.id === (focusedId || currentModelId),
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="hidden w-full justify-between truncate md:flex"
        >
          <span className="truncate">
            {selectedModel?.name || currentModelId}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-2xl p-0" align="end">
        <div className="flex h-75">
          <div className="bg-muted/30 flex-1 overflow-y-auto p-4">
            {activeModel ? (
              <ModelDetails model={activeModel} />
            ) : (
              <div className="text-muted-foreground flex h-full items-center justify-center text-sm">
                No model selected
              </div>
            )}
          </div>
          <div className="w-sm">
            <ModelList
              className="rounded-l-none border-l"
              models={models}
              currentModelId={currentModelId}
              onSelect={handleSelect}
              focusedModelId={focusedId}
              setFocusedModelId={setFocusedId}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ModelSelectorMobile() {
  const [open, setOpen] = useState(false);
  const { models, selectedModel, currentModelId, handleSelect } =
    useModelSelection(() => setOpen(false));

  const [focusedId, setFocusedId] = useState(currentModelId);

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          className="flex w-full justify-between"
        >
          <span className="truncate">
            {selectedModel?.name || currentModelId}
          </span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </DrawerTrigger>
      <DrawerContent>
        <div className="mx-auto w-full max-w-sm px-4">
          <DrawerHeader className="px-0 text-left">
            <DrawerTitle>Select Model</DrawerTitle>
            <DrawerDescription>
              Choose an AI model for your conversation.
            </DrawerDescription>
          </DrawerHeader>
          <ModelList
            models={models}
            currentModelId={currentModelId}
            onSelect={handleSelect}
            focusedModelId={focusedId}
            setFocusedModelId={setFocusedId}
            selectedModel={selectedModel}
            hideSelected
          />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function ModelSelector() {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  return isDesktop ? <ModelSelectorDesktop /> : <ModelSelectorMobile />;
}

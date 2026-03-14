import { Braces, Plus } from "lucide-react";
import { useEffect, useMemo } from "react";

import {
  Button,
  Checkbox,
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui";
import { useConversationStore } from "@/stores";
import { useFunctionsStore } from "@/stores/functions";
import { useUIStore } from "@/stores/ui";

export function FunctionAttachmentBar() {
  const activeConversationId = useConversationStore(
    (state) => state.activeConversationId,
  );
  const conversation = useConversationStore((state) =>
    state.conversations.find((item) => item.id === activeConversationId),
  );
  const toggleFunctionAttachment = useConversationStore(
    (state) => state.toggleFunctionAttachment,
  );

  const { functions, loadFunctions, isLoading } = useFunctionsStore();
  const { setPlatformView, selectFunction } = useUIStore();

  useEffect(() => {
    void loadFunctions();
  }, [loadFunctions]);

  const attachedFunctionIds = useMemo(
    () => conversation?.functionIds ?? [],
    [conversation?.functionIds],
  );
  const attachedFunctions = useMemo(
    () =>
      functions.filter((fn) => attachedFunctionIds.includes(fn.id)).slice(0, 3),
    [attachedFunctionIds, functions],
  );

  if (!conversation) {
    return null;
  }

  return (
    <div className="bg-background flex items-center justify-between gap-2 border-b px-4 py-2">
      <div className="flex min-w-0 items-center gap-2">
        <div className="text-muted-foreground flex items-center gap-1 text-xs">
          <Braces className="h-3.5 w-3.5" />
          <span>Functions</span>
          <span className="bg-muted rounded px-1.5 py-0.5 text-[10px]">
            {attachedFunctionIds.length}
          </span>
        </div>

        {attachedFunctions.length > 0 ? (
          <div className="hidden min-w-0 items-center gap-1 md:flex">
            {attachedFunctions.map((fn) => (
              <span
                key={fn.id}
                className="bg-muted text-muted-foreground max-w-36 truncate rounded px-1.5 py-0.5 text-[10px]"
                title={fn.name}
              >
                {fn.name}
              </span>
            ))}
            {attachedFunctionIds.length > attachedFunctions.length && (
              <span className="text-muted-foreground text-[10px]">
                +{attachedFunctionIds.length - attachedFunctions.length} more
              </span>
            )}
          </div>
        ) : (
          <span className="text-muted-foreground text-xs">None attached</span>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 px-2 text-xs">
              Manage
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-72 p-3">
            <PopoverHeader className="mb-2">
              <PopoverTitle className="text-xs">
                Attached Functions
              </PopoverTitle>
            </PopoverHeader>

            <div className="max-h-56 space-y-2 overflow-auto pr-1">
              {isLoading ? (
                <p className="text-muted-foreground text-xs">Loading…</p>
              ) : functions.length === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No functions available.
                </p>
              ) : (
                functions.map((fn) => {
                  const isChecked = attachedFunctionIds.includes(fn.id);
                  return (
                    <label
                      key={fn.id}
                      className="hover:bg-muted/50 flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={() =>
                          void toggleFunctionAttachment(fn.id)
                        }
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
          </PopoverContent>
        </Popover>

        <Button
          variant="ghost"
          size="sm"
          className="h-7 px-2 text-xs"
          onClick={() => {
            selectFunction(null);
            setPlatformView("functions");
          }}
        >
          <Plus className="mr-1 h-3.5 w-3.5" />
          New
        </Button>
      </div>
    </div>
  );
}

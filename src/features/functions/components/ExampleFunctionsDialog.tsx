import { CheckSquare, Square } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Checkbox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui";
import { EXAMPLE_FUNCTIONS } from "@/features/functions/utils/examples";
import { useFunctionsStore } from "@/stores/functions";

interface ExampleFunctionsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExampleFunctionsDialog({
  open,
  onOpenChange,
}: ExampleFunctionsDialogProps) {
  const [selectedNames, setSelectedNames] = useState<string[]>(
    EXAMPLE_FUNCTIONS.map((f) => f.name),
  );
  const [isImporting, setIsImporting] = useState(false);
  const importExamples = useFunctionsStore((state) => state.importExamples);

  const toggleFunction = (name: string) => {
    setSelectedNames((prev) =>
      prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name],
    );
  };

  const toggleAll = () => {
    if (selectedNames.length === EXAMPLE_FUNCTIONS.length) {
      setSelectedNames([]);
    } else {
      setSelectedNames(EXAMPLE_FUNCTIONS.map((f) => f.name));
    }
  };

  const handleImport = async () => {
    if (selectedNames.length === 0) return;

    setIsImporting(true);
    try {
      await importExamples(selectedNames, true);
      toast.success(
        `Successfully imported ${selectedNames.length} function${selectedNames.length === 1 ? "" : "s"}.`,
      );
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to import selected examples:", error);
      toast.error("Failed to import example functions.");
    } finally {
      setIsImporting(false);
    }
  };

  const allSelected = selectedNames.length === EXAMPLE_FUNCTIONS.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Import Example Functions</DialogTitle>
          <DialogDescription>
            Select the example functions you want to add to your workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-sm font-medium">Available Functions</span>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2 text-xs"
              onClick={toggleAll}
            >
              {allSelected ? (
                <CheckSquare className="text-primary mr-2 h-4 w-4" />
              ) : (
                <Square className="mr-2 h-4 w-4" />
              )}
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          </div>

          <div className="space-y-3">
            {EXAMPLE_FUNCTIONS.map((fn) => (
              <div
                key={fn.name}
                className="hover:bg-muted/50 flex cursor-pointer items-start space-x-3 rounded-lg border p-3 transition-colors"
                onClick={() => toggleFunction(fn.name)}
              >
                <Checkbox
                  checked={selectedNames.includes(fn.name)}
                  onCheckedChange={() => toggleFunction(fn.name)}
                  onClick={(e) => e.stopPropagation()}
                />
                <div className="flex-1 space-y-1">
                  <p className="text-sm leading-none font-medium">{fn.name}</p>
                  <p className="text-muted-foreground text-xs">
                    {fn.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={isImporting || selectedNames.length === 0}
          >
            {isImporting
              ? "Importing..."
              : `Import ${selectedNames.length} Functions`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

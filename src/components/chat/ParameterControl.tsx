import { Info } from "lucide-react";
import * as React from "react";

import {
  Button,
  Input,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Slider,
} from "@/components/ui";
import { cn } from "@/lib/utils";

interface ParameterControlProps {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  description?: string;
  disabled?: boolean;
  className?: string;
}

export function ParameterControl({
  id,
  label,
  value,
  min,
  max,
  step,
  onChange,
  description,
  disabled = false,
  className,
}: ParameterControlProps) {
  const [localValue, setLocalValue] = React.useState(value);
  const [inputString, setInputString] = React.useState(value.toString());

  React.useEffect(() => {
    setLocalValue(value);
    setInputString(value.toString());
  }, [value]);

  const handleSliderChange = (vals: number[]) => {
    const newValue = vals[0];
    setLocalValue(newValue);
    setInputString(newValue.toString());
  };

  const handleSliderCommit = (vals: number[]) => {
    onChange(vals[0]);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputString(e.target.value);
  };

  const commitInput = () => {
    let newValue = parseFloat(inputString);

    if (isNaN(newValue)) {
      setInputString(localValue.toString());
      return;
    }

    // Clamp value
    newValue = Math.min(Math.max(newValue, min), max);

    // Round to step
    // Use a small epsilon for floating point logic or just simple logic
    // For step 0.1, round to 1 decimal place.
    if (step > 0) {
      const precision = Math.floor(Math.log10(1 / step));
      if (precision >= 0) {
        newValue = parseFloat(newValue.toFixed(precision));
      } else {
        // Fallback for steps >= 1
        newValue = Math.round(newValue / step) * step;
      }
    }

    setLocalValue(newValue);
    setInputString(newValue.toString());
    onChange(newValue);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      commitInput();
      (e.target as HTMLInputElement).blur();
    }
  };

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label htmlFor={id} className="text-sm font-medium">
            {label}
          </Label>
          {description && (
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 cursor-help rounded-full p-0"
                  tabIndex={-1} // Prevent focus when tabbing through form
                >
                  <Info className="text-muted-foreground hover:text-foreground h-3.5 w-3.5" />
                  <span className="sr-only">Info</span>
                </Button>
              </PopoverTrigger>
              <PopoverContent side="top" className="max-w-[200px] p-2">
                <p className="text-xs">{description}</p>
              </PopoverContent>
            </Popover>
          )}
        </div>
        <div className="w-max">
          <Input
            id={`${id}-input`}
            type="number"
            value={inputString}
            onChange={handleInputChange}
            onBlur={commitInput}
            onKeyDown={handleInputKeyDown}
            disabled={disabled}
            className="h-7 [appearance:textfield] px-2 py-1 text-center font-mono text-xs [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
            step={step}
            min={min}
            max={max}
            aria-label={label}
          />
        </div>
      </div>

      <Slider
        id={id}
        min={min}
        max={max}
        step={step}
        value={[localValue]}
        onValueChange={handleSliderChange}
        onValueCommit={handleSliderCommit}
        disabled={disabled}
        className="h-full w-full"
        aria-hidden="true" // Hide from screen readers since input handles the value
      />
    </div>
  );
}

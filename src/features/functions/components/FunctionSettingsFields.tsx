import { Input, Label, Textarea } from "@/components/ui";
import { memo } from "react";

export const NameField = memo(function NameField({
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  onBlur: (v: string) => void;
  error?: string;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="fn-name" className="text-xs">
        Name <span className="text-destructive">*</span>
      </Label>
      <Input
        id="fn-name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onBlur(value)}
        placeholder="my_function"
        maxLength={64}
        aria-invalid={!!error}
        disabled={disabled}
        autoComplete="off"
        className="h-8 font-mono text-sm"
      />
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Letters, digits, underscores, dots, hyphens — max 64 chars.
        </p>
      )}
    </div>
  );
});

export const DescriptionField = memo(function DescriptionField({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="fn-desc" className="text-xs">
        Description
      </Label>
      <Textarea
        id="fn-desc"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Describe what this function does…"
        rows={3}
        disabled={disabled}
        className="resize-none text-sm"
      />
    </div>
  );
});

export const TimeoutField = memo(function TimeoutField({
  value,
  onChange,
  onBlur,
  error,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  onBlur: (v: number) => void;
  error?: string;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor="fn-timeout" className="text-xs">
        Timeout (ms)
      </Label>
      <Input
        id="fn-timeout"
        type="number"
        min={100}
        max={60000}
        step={100}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onBlur={() => onBlur(value)}
        aria-invalid={!!error}
        disabled={disabled}
        className="h-8 w-32 text-sm"
      />
      {error ? (
        <p className="text-destructive text-xs">{error}</p>
      ) : (
        <p className="text-muted-foreground text-xs">
          Max run time before the function is terminated.
        </p>
      )}
    </div>
  );
});

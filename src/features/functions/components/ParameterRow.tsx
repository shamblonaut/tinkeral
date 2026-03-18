import { Trash2 } from "lucide-react";
import { memo } from "react";

import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui";
import type { JSONSchemaPropertyType } from "@/shared/types";

import type { ParameterRowData } from "../types";

const SUPPORTED_TYPES: JSONSchemaPropertyType[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
];

export const ParameterRow = memo(function ParameterRow({
  row,
  index,
  onChange,
  onBlur,
  onRemove,
  disabled,
}: {
  row: ParameterRowData;
  index: number;
  onChange: (
    id: string,
    field: keyof ParameterRowData,
    value: string | boolean | JSONSchemaPropertyType,
  ) => void;
  onBlur: (id: string) => void;
  onRemove: (id: string) => void;
  disabled: boolean;
}) {
  return (
    <div className="bg-muted/20 space-y-2 rounded-md border p-2.5">
      <div className="grid grid-cols-[2fr_1fr] gap-2">
        <div className="flex flex-col gap-1">
          <Label className="text-xs">Name</Label>
          <Input
            value={row.name}
            placeholder="param_name"
            onChange={(e) => onChange(row.id, "name", e.target.value)}
            onBlur={() => onBlur(row.id)}
            disabled={disabled}
            aria-label={`Parameter ${index + 1} name`}
            className="h-8 text-sm"
          />
        </div>

        <div className="flex flex-col gap-1">
          <Label className="text-xs">Type</Label>
          <Select
            value={row.type}
            onValueChange={(value) =>
              onChange(row.id, "type", value as JSONSchemaPropertyType)
            }
            disabled={disabled}
          >
            <SelectTrigger
              size="sm"
              className="text-sm"
              onBlur={() => onBlur(row.id)}
              aria-label={`Parameter ${index + 1} type`}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SUPPORTED_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex flex-col gap-1">
        <Label className="text-xs">Description</Label>
        <Input
          value={row.description}
          placeholder="Optional description"
          onChange={(e) => onChange(row.id, "description", e.target.value)}
          onBlur={() => onBlur(row.id)}
          disabled={disabled}
          aria-label={`Parameter ${index + 1} description`}
          className="h-8 text-sm"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Checkbox
            id={`required-${row.id}`}
            checked={row.required}
            onCheckedChange={(checked: boolean | "indeterminate") =>
              onChange(row.id, "required", checked === true)
            }
            onBlur={() => onBlur(row.id)}
            disabled={disabled}
            aria-label={`Parameter ${index + 1} required`}
          />
          <Label className="text-xs" htmlFor={`required-${row.id}`}>
            Required
          </Label>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-destructive h-8 w-8 shrink-0"
          onClick={() => onRemove(row.id)}
          disabled={disabled}
          aria-label={`Remove parameter ${row.name || index + 1}`}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
});

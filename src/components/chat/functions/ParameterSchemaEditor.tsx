import { Plus, Trash2 } from "lucide-react";
import { useCallback } from "react";

import { Button, Input, Label } from "@/components/ui";
import { cn } from "@/lib/utils";
import type {
  JSONSchema,
  JSONSchemaProperty,
  JSONSchemaPropertyType,
} from "@/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A flat mutable representation of a single parameter for editing. */
export interface ParameterRow {
  name: string;
  type: JSONSchemaPropertyType;
  description: string;
  required: boolean;
}

export interface ParameterSchemaEditorProps {
  schema: JSONSchema;
  onChange: (schema: JSONSchema) => void;
  disabled?: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SUPPORTED_TYPES: JSONSchemaPropertyType[] = [
  "string",
  "number",
  "integer",
  "boolean",
  "array",
  "object",
];

/** Convert a JSONSchema to a flat list of ParameterRows for editing. */
function schemaToRows(schema: JSONSchema): ParameterRow[] {
  return Object.entries(schema.properties).map(([name, prop]) => ({
    name,
    type: prop.type,
    description: prop.description ?? "",
    required: schema.required?.includes(name) ?? false,
  }));
}

/** Convert a list of ParameterRows back into a JSONSchema. */
function rowsToSchema(rows: ParameterRow[]): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const row of rows) {
    properties[row.name] = {
      type: row.type,
      ...(row.description ? { description: row.description } : {}),
    };
    if (row.required) {
      required.push(row.name);
    }
  }

  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
  };
}

function emptyRow(): ParameterRow {
  return { name: "", type: "string", description: "", required: false };
}

// ---------------------------------------------------------------------------
// Select primitive — styled to match the Input component
// ---------------------------------------------------------------------------

interface NativeSelectProps extends React.ComponentProps<"select"> {
  className?: string;
}

function NativeSelect({ className, children, ...props }: NativeSelectProps) {
  return (
    <select
      className={cn(
        "border-input dark:bg-input/30 h-9 w-full rounded-md border bg-transparent px-3 py-1 text-base shadow-xs",
        "text-foreground transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        "md:text-sm",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

// ---------------------------------------------------------------------------
// ParameterSchemaEditor
// ---------------------------------------------------------------------------

/**
 * Visual editor for a flat JSON Schema `properties` structure.
 * Supports adding, editing, and removing top-level parameters.
 * Nested object schemas are not supported in this version.
 */
export function ParameterSchemaEditor({
  schema,
  onChange,
  disabled = false,
}: ParameterSchemaEditorProps) {
  const rows = schemaToRows(schema);

  const update = useCallback(
    (newRows: ParameterRow[]) => {
      onChange(rowsToSchema(newRows));
    },
    [onChange],
  );

  const handleFieldChange = useCallback(
    (index: number, field: keyof ParameterRow, value: string | boolean) => {
      const newRows = rows.map((row, i) =>
        i === index ? { ...row, [field]: value } : row,
      );
      update(newRows);
    },
    [rows, update],
  );

  const handleAdd = useCallback(() => {
    update([...rows, emptyRow()]);
  }, [rows, update]);

  const handleRemove = useCallback(
    (index: number) => {
      update(rows.filter((_, i) => i !== index));
    },
    [rows, update],
  );

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No parameters defined. Add a parameter below.
        </p>
      ) : (
        <div className="space-y-3">
          {/* Header labels — hidden on small screens */}
          <div className="text-muted-foreground hidden grid-cols-[2fr_1fr_2fr_auto_auto] gap-2 text-xs font-medium md:grid">
            <span>Name</span>
            <span>Type</span>
            <span>Description</span>
            <span>Required</span>
            <span />
          </div>

          {rows.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-1 gap-2 md:grid-cols-[2fr_1fr_2fr_auto_auto] md:items-center"
            >
              {/* Name */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs md:hidden">Name</Label>
                <Input
                  value={row.name}
                  placeholder="param_name"
                  onChange={(e) =>
                    handleFieldChange(index, "name", e.target.value)
                  }
                  disabled={disabled}
                  aria-label={`Parameter ${index + 1} name`}
                />
              </div>

              {/* Type */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs md:hidden">Type</Label>
                <NativeSelect
                  value={row.type}
                  onChange={(e) =>
                    handleFieldChange(
                      index,
                      "type",
                      e.target.value as JSONSchemaPropertyType,
                    )
                  }
                  disabled={disabled}
                  aria-label={`Parameter ${index + 1} type`}
                >
                  {SUPPORTED_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </NativeSelect>
              </div>

              {/* Description */}
              <div className="flex flex-col gap-1">
                <Label className="text-xs md:hidden">Description</Label>
                <Input
                  value={row.description}
                  placeholder="Optional description"
                  onChange={(e) =>
                    handleFieldChange(index, "description", e.target.value)
                  }
                  disabled={disabled}
                  aria-label={`Parameter ${index + 1} description`}
                />
              </div>

              {/* Required checkbox */}
              <div className="flex items-center gap-2 md:justify-center">
                <Label
                  className="text-xs md:hidden"
                  htmlFor={`required-${index}`}
                >
                  Required
                </Label>
                <input
                  id={`required-${index}`}
                  type="checkbox"
                  checked={row.required}
                  onChange={(e) =>
                    handleFieldChange(index, "required", e.target.checked)
                  }
                  disabled={disabled}
                  className="accent-primary h-4 w-4 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label={`Parameter ${index + 1} required`}
                />
              </div>

              {/* Remove */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive h-9 w-9 shrink-0"
                onClick={() => handleRemove(index)}
                disabled={disabled}
                aria-label={`Remove parameter ${row.name || index + 1}`}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleAdd}
        disabled={disabled}
        className="w-full"
      >
        <Plus className="mr-1 h-4 w-4" />
        Add Parameter
      </Button>
    </div>
  );
}

import { Plus } from "lucide-react";
import { memo, useCallback, useEffect, useState } from "react";

import { Button } from "@/components/ui";
import type { JSONSchemaPropertyType } from "@/types";
import type { ParameterRowData, ParameterSchemaEditorProps } from "../types";

import { emptyRow, rowsToSchema, schemaToRows } from "../utils/schema";

import { ParameterRow } from "./ParameterRow";

export const ParameterSchemaEditor = memo(function ParameterSchemaEditor({
  schema,
  onChange,
  disabled = false,
}: ParameterSchemaEditorProps) {
  const [rows, setRows] = useState<ParameterRowData[]>(() =>
    schemaToRows(schema),
  );

  useEffect(() => {
    setRows(schemaToRows(schema));
  }, [schema]);

  const handleFieldChange = useCallback(
    (
      id: string,
      field: keyof ParameterRowData,
      value: string | boolean | JSONSchemaPropertyType,
    ) => {
      setRows((prev) => {
        return prev.map((row) =>
          row.id === id ? { ...row, [field]: value } : row,
        );
      });
    },
    [],
  );

  const handleFieldBlur = useCallback(
    (id: string) => {
      setRows((prev) => {
        const hasEmptyName = prev.some(
          (row) => row.id === id && !row.name.trim(),
        );
        const next = hasEmptyName ? prev.filter((row) => row.id !== id) : prev;
        onChange(rowsToSchema(next));
        return next;
      });
    },
    [onChange],
  );

  const handleAdd = useCallback(() => {
    setRows((prev) => {
      if (prev.some((row) => !row.name.trim())) {
        return prev;
      }
      return [...prev, emptyRow()];
    });
  }, []);

  const handleRemove = useCallback(
    (id: string) => {
      setRows((prev) => {
        const next = prev.filter((row) => row.id !== id);
        onChange(rowsToSchema(next));
        return next;
      });
    },
    [onChange],
  );

  return (
    <div className="space-y-3">
      {rows.length === 0 ? (
        <p className="text-muted-foreground py-4 text-center text-sm">
          No parameters defined. Add a parameter below.
        </p>
      ) : (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <ParameterRow
              key={row.id}
              row={row}
              index={index}
              onChange={handleFieldChange}
              onBlur={handleFieldBlur}
              onRemove={handleRemove}
              disabled={disabled}
            />
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
});

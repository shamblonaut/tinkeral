import type { JSONSchema, JSONSchemaProperty } from "@/types";
import type { ParameterRowData } from "../types";

/**
 * Converts a JSONSchema object into an array of ParameterRowData for the UI.
 */
export function schemaToRows(schema: JSONSchema): ParameterRowData[] {
  return Object.entries(schema.properties).map(([name, prop]) => ({
    id: crypto.randomUUID(),
    name,
    type: prop.type,
    description: prop.description ?? "",
    required: schema.required?.includes(name) ?? false,
  }));
}

/**
 * Converts an array of ParameterRowData from the UI back into a JSONSchema object.
 */
export function rowsToSchema(rows: ParameterRowData[]): JSONSchema {
  const properties: Record<string, JSONSchemaProperty> = {};
  const required: string[] = [];

  for (const row of rows) {
    if (!row.name.trim()) continue;
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

/**
 * Creates a default empty parameter row.
 */
export function emptyRow(): ParameterRowData {
  return {
    id: crypto.randomUUID(),
    name: "",
    type: "string",
    description: "",
    required: false,
  };
}

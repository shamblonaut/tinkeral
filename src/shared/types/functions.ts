/** Supported primitive types for function parameter properties. */
export type JSONSchemaPropertyType =
  | "string"
  | "number"
  | "integer"
  | "boolean"
  | "array"
  | "object";

/** A single property inside a JSON Schema `properties` map. */
export interface JSONSchemaProperty {
  type: JSONSchemaPropertyType;
  description?: string;
  enum?: unknown[];
  items?: JSONSchemaProperty;
  properties?: Record<string, JSONSchemaProperty>;
  required?: string[];
}

/**
 * Top-level JSON Schema for a function's parameters.
 *
 * `properties` is typed with `JSONSchemaProperty` so the
 * ParameterSchemaEditor can read/write individual fields
 * without casting through `unknown`.
 */
export interface JSONSchema {
  type: "object";
  properties: Record<string, JSONSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

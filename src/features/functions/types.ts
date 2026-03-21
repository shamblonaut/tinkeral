import type { ReactNode } from "react";

import type { FunctionDefinition } from "@/db";
import type { JSONSchema, JSONSchemaPropertyType } from "@/shared/types";
export type { JSONSchema, JSONSchemaPropertyType };

export type { FunctionDefinition } from "@/db";

export interface FormErrors {
  name?: string;
  description?: string;
  parameters?: string;
  implementation?: string;
  timeout?: string;
}

export interface CodeEditorProps {
  /** Initial document content */
  value?: string;
  /** Called whenever the document changes */
  onChange?: (value: string) => void;
  /** Called when the editor loses focus */
  onBlur?: () => void;
  /** Placeholder shown when editor is empty */
  placeholder?: string;
  /** Make the editor read-only */
  readOnly?: boolean;
  /** Additional CSS class names for the wrapper */
  className?: string;
  /** Minimum height in px (default: 150) */
  minHeight?: number;
  /** Maximum height in px (default: 400) */
  maxHeight?: number;
}

export interface CodeEditorHandle {
  /** Get the current document text */
  getValue: () => string;
  /** Focus the editor */
  focus: () => void;
}

export interface FunctionEditorContextValue {
  // Metadata
  name: string;
  setName: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  schema: JSONSchema;
  setSchema: (v: JSONSchema) => void;
  timeout: number;
  setTimeoutValue: (v: number) => void;

  // Implementation
  implementation: string;
  setImplementation: (v: string) => void;
  editorRef: React.RefObject<CodeEditorHandle | null>;

  // Shared
  errors: FormErrors;
  setErrors: React.Dispatch<React.SetStateAction<FormErrors>>;
  isSaving: boolean;
  isEditMode: boolean;
  isDirty: boolean;

  // Handlers
  handleNameBlur: (v: string) => void;
  handleParametersBlur: (v: JSONSchema) => void;
  handleImplementationBlur: (v: string) => void;
  handleTimeoutBlur: (v: number) => void;
  validateDraft: () => boolean;
  resetDraft: () => void;
  saveMetadata: () => Promise<void>;
  onCancel?: () => void;
}

export interface ParameterRowData {
  id: string;
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

export interface FunctionEditorProviderProps {
  initialValues?: FunctionDefinition;
  onSave?: (id: string) => void;
  onCancel?: () => void;
  children: ReactNode;
}

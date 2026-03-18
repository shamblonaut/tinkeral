import { useCallback, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import type { JSONSchema } from "@/shared/types";

import { FunctionEditorContext } from "../context";
import { useFunctionsStore } from "../store";
import type {
  CodeEditorHandle,
  FormErrors,
  FunctionEditorProviderProps,
} from "../types";
import {
  validateImplementation,
  validateName,
  validateParameters,
  validateTimeout,
} from "../utils/validation";

const DEFAULT_TIMEOUT = 5000;
const DEFAULT_SCHEMA: JSONSchema = { type: "object", properties: {} };

export function FunctionEditorProvider({
  initialValues,
  onSave,
  onCancel,
  children,
}: FunctionEditorProviderProps) {
  const isEditMode = !!initialValues;

  // Metadata State
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [schema, setSchema] = useState<JSONSchema>(
    initialValues?.parameters ?? DEFAULT_SCHEMA,
  );
  const [timeout, setTimeoutValue] = useState(
    initialValues?.timeout ?? DEFAULT_TIMEOUT,
  );

  // Implementation State
  const [implementation, setImplementation] = useState(
    initialValues?.implementation ?? "",
  );

  // Shared State
  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<CodeEditorHandle | null>(null);
  const initialSnapshotRef = useRef({
    name: initialValues?.name ?? "",
    description: initialValues?.description ?? "",
    schema: initialValues?.parameters ?? DEFAULT_SCHEMA,
    implementation: initialValues?.implementation ?? "",
    timeout: initialValues?.timeout ?? DEFAULT_TIMEOUT,
  });

  const { createFunction, updateFunction, functions } = useFunctionsStore();

  const checkNameUniqueness = useCallback(
    (value: string): string | undefined => {
      if (!value.trim()) return undefined;
      const dupe = functions.find(
        (f) => f.name === value && f.id !== initialValues?.id,
      );
      return dupe ? `A function named "${value}" already exists.` : undefined;
    },
    [functions, initialValues?.id],
  );

  const handleNameBlur = useCallback(
    (value: string) => {
      const formatError = validateName(value);
      const uniqueError = formatError ? undefined : checkNameUniqueness(value);
      setErrors((prev) => ({ ...prev, name: formatError ?? uniqueError }));
    },
    [checkNameUniqueness],
  );

  const handleParametersBlur = useCallback((value: JSONSchema) => {
    setErrors((prev) => ({ ...prev, parameters: validateParameters(value) }));
  }, []);

  const handleImplementationBlur = useCallback((value: string) => {
    setErrors((prev) => ({
      ...prev,
      implementation: validateImplementation(value),
    }));
  }, []);

  const handleTimeoutBlur = useCallback((value: number) => {
    setErrors((prev) => ({ ...prev, timeout: validateTimeout(value) }));
  }, []);

  const validateDraft = useCallback((): boolean => {
    const nextErrors: FormErrors = {
      name: validateName(name) ?? checkNameUniqueness(name),
      parameters: validateParameters(schema),
      implementation: validateImplementation(implementation),
      timeout: validateTimeout(timeout),
    };

    setErrors((prev) => ({ ...prev, ...nextErrors }));
    return !Object.values(nextErrors).some(Boolean);
  }, [name, checkNameUniqueness, schema, implementation, timeout, setErrors]);

  const isDirty = useMemo(() => {
    const initial = initialSnapshotRef.current;

    const nameDirty = name !== initial.name;
    const descriptionDirty = description !== initial.description;
    const implementationDirty = implementation !== initial.implementation;
    const timeoutDirty = timeout !== initial.timeout;
    const schemaDirty =
      JSON.stringify(schema) !== JSON.stringify(initial.schema);

    return (
      nameDirty ||
      descriptionDirty ||
      implementationDirty ||
      timeoutDirty ||
      schemaDirty
    );
  }, [name, description, implementation, timeout, schema]);

  const resetDraft = useCallback(() => {
    const initial = initialSnapshotRef.current;
    setName(initial.name);
    setDescription(initial.description);
    setSchema(initial.schema);
    setImplementation(initial.implementation);
    setTimeoutValue(initial.timeout);
    setErrors({});
  }, []);

  const saveMetadata = useCallback(async () => {
    if (!validateDraft()) {
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        parameters: schema,
        implementation,
        timeout,
      };

      if (isEditMode && initialValues) {
        await updateFunction(initialValues.id, payload);
        toast.success("Function saved.");
      } else {
        const id = await createFunction(payload);
        toast.success("Function created.");
        onSave?.(id);
      }
    } catch {
      toast.error("Failed to save function.");
    } finally {
      setIsSaving(false);
    }
  }, [
    name,
    description,
    schema,
    timeout,
    implementation,
    isEditMode,
    initialValues,
    validateDraft,
    createFunction,
    updateFunction,
    onSave,
  ]);

  const value = useMemo(
    () => ({
      name,
      setName,
      description,
      setDescription,
      schema,
      setSchema,
      timeout,
      setTimeoutValue,
      implementation,
      setImplementation,
      errors,
      setErrors,
      isSaving,
      isEditMode,
      isDirty,
      editorRef,
      handleNameBlur,
      handleParametersBlur,
      handleImplementationBlur,
      handleTimeoutBlur,
      validateDraft,
      resetDraft,
      saveMetadata,
      onCancel,
    }),
    [
      name,
      description,
      schema,
      timeout,
      implementation,
      errors,
      isSaving,
      isEditMode,
      isDirty,
      handleNameBlur,
      handleParametersBlur,
      handleImplementationBlur,
      handleTimeoutBlur,
      validateDraft,
      resetDraft,
      saveMetadata,
      onCancel,
    ],
  );

  return (
    <FunctionEditorContext.Provider value={value}>
      {children}
    </FunctionEditorContext.Provider>
  );
}

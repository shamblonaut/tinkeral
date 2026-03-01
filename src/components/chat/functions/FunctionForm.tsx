import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

import {
  Button,
  Input,
  Label,
  ScrollArea,
  Separator,
  Textarea,
} from "@/components/ui";
import { FunctionExecutor } from "@/services/executor";
import { useFunctionsStore } from "@/stores/functions";
import type { FunctionDefinition, JSONSchema } from "@/types";

import CodeEditor, { type CodeEditorHandle } from "./CodeEditor";
import { ParameterSchemaEditor } from "./ParameterSchemaEditor";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const NAME_REGEX = /^[a-zA-Z0-9_.\\-]{1,64}$/;
const DEFAULT_TIMEOUT = 5000;
const DEFAULT_SCHEMA: JSONSchema = { type: "object", properties: {} };

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FunctionFormProps {
  /** When provided, the form operates in edit mode. */
  initialValues?: FunctionDefinition;
  /** Called with the saved function's ID when save succeeds. */
  onSave?: (id: string) => void;
  /** Called when the user clicks Cancel. */
  onCancel?: () => void;
}

interface FormErrors {
  name?: string;
  description?: string;
  parameters?: string;
  implementation?: string;
  timeout?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function validateName(name: string): string | undefined {
  if (!name.trim()) return "Name is required.";
  if (!NAME_REGEX.test(name)) {
    return "Name may only contain letters, digits, underscores, dots, and hyphens (max 64 chars).";
  }
  return undefined;
}

function validateParameters(schema: JSONSchema): string | undefined {
  const names = Object.keys(schema.properties);
  const emptyNames = names.filter((n) => n.trim() === "");
  if (emptyNames.length > 0)
    return "All parameters must have a non-empty name.";
  const seen = new Set<string>();
  for (const n of names) {
    if (seen.has(n)) return `Duplicate parameter name: "${n}".`;
    seen.add(n);
  }
  return undefined;
}

function validateTimeout(value: number): string | undefined {
  if (!Number.isFinite(value) || value < 100) {
    return "Timeout must be at least 100 ms.";
  }
  if (value > 60_000) {
    return "Timeout must not exceed 60 000 ms.";
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// FunctionForm
// ---------------------------------------------------------------------------

/**
 * Create or edit a `FunctionDefinition`.
 *
 * - Pass `initialValues` to enter **edit mode**.
 * - Omit it (or pass `undefined`) for **create mode**.
 *
 * Validation covers:
 * - Name format (pattern + uniqueness)
 * - Parameter names (non-empty, unique)
 * - JavaScript syntax check on the implementation (run on blur)
 * - Timeout range (100 – 60 000 ms)
 */
export function FunctionForm({
  initialValues,
  onSave,
  onCancel,
}: FunctionFormProps) {
  const isEditMode = !!initialValues;

  // ── Local form state ──────────────────────────────────────────────────────
  const [name, setName] = useState(initialValues?.name ?? "");
  const [description, setDescription] = useState(
    initialValues?.description ?? "",
  );
  const [schema, setSchema] = useState<JSONSchema>(
    initialValues?.parameters ?? DEFAULT_SCHEMA,
  );
  const [implementation, setImplementation] = useState(
    initialValues?.implementation ?? "",
  );
  const [timeout, setTimeoutValue] = useState(
    initialValues?.timeout ?? DEFAULT_TIMEOUT,
  );

  const [errors, setErrors] = useState<FormErrors>({});
  const [isSaving, setIsSaving] = useState(false);

  // Ref to CodeEditor so we can call getValue() on demand
  const editorRef = useRef<CodeEditorHandle>(null);

  // ── Store ─────────────────────────────────────────────────────────────────
  const { createFunction, updateFunction, functions } = useFunctionsStore();

  // ── Validation helpers ────────────────────────────────────────────────────
  const checkNameUniqueness = useCallback(
    (value: string): string | undefined => {
      const dupe = functions.find(
        (f) =>
          f.name === value &&
          // In edit mode, ignore the function being edited
          f.id !== initialValues?.id,
      );
      if (dupe) return `A function named "${value}" already exists.`;
      return undefined;
    },
    [functions, initialValues?.id],
  );

  const validateImplementation = useCallback(
    (code: string): string | undefined => {
      if (!code.trim()) return "Implementation is required.";
      const executor = new FunctionExecutor();
      const result = executor.validate(code);
      if (!result.valid) return `Syntax error: ${result.error}`;
      return undefined;
    },
    [],
  );

  // ── Field blur handlers ───────────────────────────────────────────────────
  const handleNameBlur = useCallback(() => {
    const formatError = validateName(name);
    const uniqueError = formatError ? undefined : checkNameUniqueness(name);
    setErrors((prev) => ({ ...prev, name: formatError ?? uniqueError }));
  }, [name, checkNameUniqueness]);

  const handleImplementationBlur = useCallback(() => {
    // Sync latest editor value into state then validate
    const current = editorRef.current?.getValue() ?? implementation;
    if (current !== implementation) setImplementation(current);
    setErrors((prev) => ({
      ...prev,
      implementation: validateImplementation(current),
    }));
  }, [implementation, validateImplementation]);

  const handleTimeoutBlur = useCallback(() => {
    setErrors((prev) => ({ ...prev, timeout: validateTimeout(timeout) }));
  }, [timeout]);

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get latest implementation value from editor
    const currentImpl = editorRef.current?.getValue() ?? implementation;
    if (currentImpl !== implementation) setImplementation(currentImpl);

    // Run all validations
    const newErrors: FormErrors = {
      name: validateName(name) ?? checkNameUniqueness(name),
      parameters: validateParameters(schema),
      implementation: validateImplementation(currentImpl),
      timeout: validateTimeout(timeout),
    };

    if (Object.values(newErrors).some(Boolean)) {
      setErrors(newErrors);
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        parameters: schema,
        implementation: currentImpl,
        timeout,
      };

      let savedId: string;
      if (isEditMode && initialValues) {
        await updateFunction(initialValues.id, payload);
        savedId = initialValues.id;
        toast.success(`Function "${name}" updated.`);
      } else {
        savedId = await createFunction(payload);
        toast.success(`Function "${name}" created.`);
      }

      onSave?.(savedId);
    } catch {
      toast.error("Failed to save function. Please try again.");
    } finally {
      setIsSaving(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <ScrollArea className="h-full">
      <form
        onSubmit={handleSubmit}
        noValidate
        className="space-y-6 p-4"
        aria-label={isEditMode ? "Edit function" : "Create function"}
      >
        {/* ── Name ─────────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="fn-name">
            Name <span className="text-destructive">*</span>
          </Label>
          <Input
            id="fn-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={handleNameBlur}
            placeholder="my_function"
            maxLength={64}
            aria-invalid={!!errors.name}
            aria-describedby={errors.name ? "fn-name-error" : undefined}
            disabled={isSaving}
            autoComplete="off"
          />
          {errors.name && (
            <p id="fn-name-error" className="text-destructive text-sm">
              {errors.name}
            </p>
          )}
          <p className="text-muted-foreground text-xs">
            Letters, digits, underscores, dots, hyphens — max 64 characters.
          </p>
        </div>

        {/* ── Description ──────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="fn-desc">Description</Label>
          <Textarea
            id="fn-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what this function does…"
            rows={3}
            disabled={isSaving}
          />
        </div>

        <Separator />

        {/* ── Parameters ───────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold">Parameters</h3>
            <p className="text-muted-foreground text-xs">
              Define the inputs this function accepts. Flat schemas only —
              nested objects are not supported yet.
            </p>
          </div>

          <ParameterSchemaEditor
            schema={schema}
            onChange={(next) => {
              setSchema(next);
              // Clear parameter error on change
              const paramError = validateParameters(next);
              setErrors((prev) => ({ ...prev, parameters: paramError }));
            }}
            disabled={isSaving}
          />

          {errors.parameters && (
            <p className="text-destructive text-sm">{errors.parameters}</p>
          )}
        </div>

        <Separator />

        {/* ── Implementation ───────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="fn-impl">
            Implementation <span className="text-destructive">*</span>
          </Label>
          <p className="text-muted-foreground text-xs">
            Write the function body in JavaScript. The parameter object is
            available as <code className="font-mono">args</code>. Top-level{" "}
            <code className="font-mono">await</code> is supported. Return any
            JSON-serialisable value.
          </p>
          <CodeEditor
            ref={editorRef}
            value={implementation}
            onChange={setImplementation}
            onBlur={handleImplementationBlur}
            placeholder={`// Example:\nconst { location } = args;\nreturn { temperature: 22, unit: "celsius", location };`}
            minHeight={180}
            maxHeight={500}
          />
          {errors.implementation && (
            <p className="text-destructive text-sm">{errors.implementation}</p>
          )}
        </div>

        <Separator />

        {/* ── Timeout ──────────────────────────────────────────────────────── */}
        <div className="space-y-2">
          <Label htmlFor="fn-timeout">Timeout (ms)</Label>
          <Input
            id="fn-timeout"
            type="number"
            min={100}
            max={60000}
            step={100}
            value={timeout}
            onChange={(e) => setTimeoutValue(Number(e.target.value))}
            onBlur={handleTimeoutBlur}
            aria-invalid={!!errors.timeout}
            aria-describedby={errors.timeout ? "fn-timeout-error" : undefined}
            disabled={isSaving}
            className="w-36"
          />
          {errors.timeout ? (
            <p id="fn-timeout-error" className="text-destructive text-sm">
              {errors.timeout}
            </p>
          ) : (
            <p className="text-muted-foreground text-xs">
              How long the function may run before being terminated. Default: 5
              000 ms.
            </p>
          )}
        </div>

        {/* ── Actions ──────────────────────────────────────────────────────── */}
        <div className="flex justify-end gap-2 pt-2">
          {onCancel && (
            <Button
              type="button"
              variant="ghost"
              onClick={onCancel}
              disabled={isSaving}
            >
              Cancel
            </Button>
          )}
          <Button type="submit" disabled={isSaving}>
            {isSaving
              ? "Saving…"
              : isEditMode
                ? "Save Changes"
                : "Create Function"}
          </Button>
        </div>
      </form>
    </ScrollArea>
  );
}

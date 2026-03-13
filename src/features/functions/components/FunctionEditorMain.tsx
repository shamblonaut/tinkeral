import {
  Button,
  ScrollArea,
  Separator,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui";
import { cn } from "@/lib/utils";

import { useFunctionEditor } from "../hooks";
import CodeEditor from "./CodeEditor";
import {
  DescriptionField,
  NameField,
  TimeoutField,
} from "./FunctionSettingsFields";
import { FunctionTestRunner } from "./FunctionTestRunner";
import { ParameterSchemaEditor } from "./ParameterSchemaEditor";

/**
 * Unified main view for creating/editing functions.
 * Includes metadata, parameters, implementation, and options.
 */
export function FunctionEditorMain() {
  const {
    name,
    setName,
    description,
    setDescription,
    schema,
    setSchema,
    timeout,
    errors,
    setTimeoutValue,
    implementation,
    setImplementation,
    editorRef,
    isSaving,
    isEditMode,
    isDirty,
    handleNameBlur,
    handleParametersBlur,
    handleImplementationBlur,
    handleTimeoutBlur,
    resetDraft,
    saveMetadata,
  } = useFunctionEditor();

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-col gap-3 border-b px-4 py-3 md:flex-row md:items-center md:justify-between">
        <h2 className="text-sm font-semibold">
          {isEditMode ? "Edit Function" : "New Function"}
        </h2>
        <div className="flex w-full items-center justify-between gap-2 md:w-auto md:justify-end">
          <span
            className={cn(
              "text-xs",
              isDirty ? "text-amber-500" : "text-muted-foreground",
            )}
          >
            {isDirty ? "Unsaved changes" : "Saved"}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[360px_1fr]">
        <div className="flex min-h-0 flex-col md:border-r md:border-b-0">
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-6 p-4">
              <NameField
                value={name}
                onChange={setName}
                onBlur={handleNameBlur}
                error={errors.name}
                disabled={isSaving}
              />

              <DescriptionField
                value={description}
                onChange={setDescription}
                disabled={isSaving}
              />

              <Separator />

              <div className="space-y-2">
                <div>
                  <h4 className="text-xs font-semibold">Parameters</h4>
                  <p className="text-muted-foreground text-xs">
                    Flat schemas only — nested objects not yet supported.
                  </p>
                </div>
                <ParameterSchemaEditor
                  schema={schema}
                  onChange={(nextSchema) => {
                    setSchema(nextSchema);
                    handleParametersBlur(nextSchema);
                  }}
                  disabled={isSaving}
                />
                {errors.parameters && (
                  <p className="text-destructive text-xs">
                    {errors.parameters}
                  </p>
                )}
              </div>

              <Separator />

              <div className="space-y-2">
                <h4 className="text-xs font-semibold">Other Options</h4>
                <TimeoutField
                  value={timeout}
                  onChange={setTimeoutValue}
                  onBlur={handleTimeoutBlur}
                  error={errors.timeout}
                  disabled={isSaving}
                />
              </div>

              <div className="space-y-2 md:hidden">
                <Separator />
                <Tabs defaultValue="implementation" className="h-full">
                  <TabsList className="w-full">
                    <TabsTrigger value="implementation">
                      Implementation
                    </TabsTrigger>
                    <TabsTrigger value="test">Test</TabsTrigger>
                  </TabsList>

                  <TabsContent
                    value="implementation"
                    className="space-y-2 pt-3"
                  >
                    <h4 className="text-xs font-semibold">Implementation</h4>
                    <div className="text-muted-foreground text-xs">
                      <code className="font-mono">args</code> — parameter object
                      · <code className="font-mono">await</code> supported ·
                      return any JSON-serialisable value
                    </div>
                    <div className="relative h-64 overflow-hidden rounded-md border">
                      <CodeEditor
                        ref={editorRef}
                        value={implementation}
                        onChange={setImplementation}
                        onBlur={() =>
                          handleImplementationBlur(
                            editorRef.current?.getValue() ?? implementation,
                          )
                        }
                        placeholder="// Implementation of the function"
                        className="absolute inset-0 h-full w-full"
                        readOnly={isSaving}
                      />
                    </div>
                  </TabsContent>

                  <TabsContent
                    value="test"
                    className="h-112 min-h-0 rounded-md border pt-0"
                  >
                    <FunctionTestRunner
                      name={name}
                      schema={schema}
                      implementation={implementation}
                      timeout={timeout}
                      disabled={isSaving}
                    />
                  </TabsContent>
                </Tabs>
              </div>
            </div>
          </ScrollArea>

          <div className="mt-auto border-t p-3">
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="flex-1"
                disabled={isSaving || !isDirty}
                onClick={resetDraft}
              >
                Reset
              </Button>
              <Button
                size="sm"
                className="flex-1"
                disabled={isSaving || !isDirty}
                onClick={() => void saveMetadata()}
              >
                {isSaving
                  ? "Saving…"
                  : isEditMode
                    ? "Save Function"
                    : "Create Function"}
              </Button>
            </div>
          </div>
        </div>

        <div className="hidden min-h-0 flex-col md:flex">
          <Tabs defaultValue="implementation" className="h-full">
            <div className="space-y-2 border-b px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <h4 className="text-xs font-semibold">Function Workspace</h4>
                <TabsList>
                  <TabsTrigger value="implementation">
                    Implementation
                  </TabsTrigger>
                  <TabsTrigger value="test">Test</TabsTrigger>
                </TabsList>
              </div>
              <div className="text-muted-foreground text-xs">
                <code className="font-mono">args</code> — parameter object ·{" "}
                <code className="font-mono">await</code> supported · return any
                JSON-serialisable value
              </div>
            </div>

            <TabsContent
              value="implementation"
              className="relative min-h-75 flex-1 overflow-hidden"
            >
              <CodeEditor
                ref={editorRef}
                value={implementation}
                onChange={setImplementation}
                onBlur={() =>
                  handleImplementationBlur(
                    editorRef.current?.getValue() ?? implementation,
                  )
                }
                placeholder="// Implementation of the function"
                className="absolute inset-0 h-full w-full"
                readOnly={isSaving}
              />
            </TabsContent>

            <TabsContent
              value="test"
              className="min-h-0 flex-1 overflow-hidden"
            >
              <FunctionTestRunner
                name={name}
                schema={schema}
                implementation={implementation}
                timeout={timeout}
                disabled={isSaving}
              />
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {errors.implementation && (
        <div className="border-t px-4 py-2">
          <p className="text-destructive text-xs">{errors.implementation}</p>
        </div>
      )}
    </div>
  );
}

import { renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import { FunctionEditorContext } from "../../context";
import type { FunctionEditorContextValue } from "../../types";
import { useFunctionEditor } from "../useFunctionEditor";

const mockContext = {
  name: "demo",
  description: "",
  schema: { type: "object", properties: {} },
  implementation: "return true;",
  timeout: 5000,
  errors: {},
  isSaving: false,
  isEditMode: false,
  isDirty: false,
  setName: () => {},
  setDescription: () => {},
  setSchema: () => {},
  setImplementation: () => {},
  setTimeoutValue: () => {},
  editorRef: { current: null },
  setErrors: () => {},
  validateDraft: () => true,
  saveMetadata: async () => {},
  resetDraft: () => {},
  handleNameBlur: () => {},
  handleParametersBlur: () => {},
  handleImplementationBlur: () => {},
  handleTimeoutBlur: () => {},
} satisfies FunctionEditorContextValue;

describe("useFunctionEditor", () => {
  it("throws outside provider", () => {
    expect(() => renderHook(() => useFunctionEditor())).toThrow(
      "useFunctionEditor must be used within FunctionEditorProvider",
    );
  });

  it("returns context inside provider", () => {
    const wrapper = ({ children }: { children: ReactNode }) => (
      <FunctionEditorContext.Provider value={mockContext}>
        {children}
      </FunctionEditorContext.Provider>
    );

    const { result } = renderHook(() => useFunctionEditor(), { wrapper });

    expect(result.current.name).toBe("demo");
    expect(result.current.implementation).toBe("return true;");
  });
});

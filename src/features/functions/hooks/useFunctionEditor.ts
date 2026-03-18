import { useContext } from "react";

import { FunctionEditorContext } from "../context";

export function useFunctionEditor() {
  const context = useContext(FunctionEditorContext);
  if (!context) {
    throw new Error(
      "useFunctionEditor must be used within FunctionEditorProvider",
    );
  }
  return context;
}

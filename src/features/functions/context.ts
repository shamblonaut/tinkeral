import { createContext } from "react";
import type { FunctionEditorContextValue } from "./types";

export const FunctionEditorContext =
  createContext<FunctionEditorContextValue | null>(null);

import { create } from "zustand";

import { functions as functionsDB } from "@/db";
import { EXAMPLE_FUNCTIONS } from "@/features/functions/utils/examples";
import type { FunctionDefinition } from "@/types";

export interface FunctionsState {
  functions: FunctionDefinition[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadFunctions: () => Promise<void>;
  createFunction: (
    fn: Omit<FunctionDefinition, "id" | "createdAt" | "updatedAt">,
  ) => Promise<string>;
  updateFunction: (
    id: string,
    changes: Partial<Omit<FunctionDefinition, "id" | "createdAt">>,
  ) => Promise<void>;
  deleteFunction: (id: string) => Promise<void>;
  getFunction: (id: string) => FunctionDefinition | undefined;
  importExamples: (names?: string[], ignoreExisting?: boolean) => Promise<void>;
}

export const useFunctionsStore = create<FunctionsState>((set, get) => ({
  functions: [],
  isLoading: false,
  error: null,

  loadFunctions: async () => {
    set({ isLoading: true, error: null });
    try {
      const all = await functionsDB.getAll();
      set({ functions: all, isLoading: false });
    } catch (error) {
      console.error("Failed to load functions:", error);
      set({ error: "Failed to load functions", isLoading: false });
    }
  },

  createFunction: async (fn) => {
    const now = Date.now();
    try {
      const id = await functionsDB.create({
        ...fn,
        createdAt: now,
        updatedAt: now,
      });
      const created = await functionsDB.get(id);
      if (created) {
        set((state) => ({ functions: [...state.functions, created] }));
      }
      return id;
    } catch (error) {
      console.error("Failed to create function:", error);
      set({ error: "Failed to create function" });
      throw error;
    }
  },

  updateFunction: async (id, changes) => {
    try {
      await functionsDB.update(id, changes);
      const updated = await functionsDB.get(id);
      if (updated) {
        set((state) => ({
          functions: state.functions.map((f) => (f.id === id ? updated : f)),
        }));
      }
    } catch (error) {
      console.error("Failed to update function:", error);
      set({ error: "Failed to update function" });
      throw error;
    }
  },

  deleteFunction: async (id) => {
    try {
      await functionsDB.delete(id);
      set((state) => ({
        functions: state.functions.filter((f) => f.id !== id),
      }));
    } catch (error) {
      console.error("Failed to delete function:", error);
      set({ error: "Failed to delete function" });
      throw error;
    }
  },

  getFunction: (id) => {
    return get().functions.find((f) => f.id === id);
  },

  importExamples: async (names, ignoreExisting = true) => {
    const { functions: existingFunctions, createFunction } = get();

    for (const example of EXAMPLE_FUNCTIONS) {
      if (names && !names.includes(example.name)) {
        continue;
      }

      const exists = existingFunctions.some((f) => f.name === example.name);

      if (ignoreExisting && exists) {
        continue;
      }

      await createFunction(example);
    }
  },
}));

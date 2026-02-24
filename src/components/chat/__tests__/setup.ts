/**
 * Shared test setup for chat component integration tests.
 * Import this in each chat __tests__ file.
 */
import { beforeEach, vi } from "vitest";

import { useConversationStore, useSettingsStore, useUIStore } from "@/stores";
import type { ModelInfo } from "@/types";

// ---------------------------------------------------------------------------
// Global DOM stubs (run once at import time)
// ---------------------------------------------------------------------------

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

class MockPointerEvent extends Event {
  button: number;
  ctrlKey: boolean;
  pointerType: string;
  constructor(type: string, props: PointerEventInit) {
    super(type, props);
    this.button = props.button || 0;
    this.ctrlKey = props.ctrlKey || false;
    this.pointerType = props.pointerType || "mouse";
  }
}
window.PointerEvent = MockPointerEvent as unknown as typeof PointerEvent;
window.HTMLElement.prototype.scrollIntoView = vi.fn();
window.HTMLElement.prototype.releasePointerCapture = vi.fn();
window.HTMLElement.prototype.hasPointerCapture = vi.fn();

// ---------------------------------------------------------------------------
// Shared model helpers
// ---------------------------------------------------------------------------

export const createMockModel = (id: string, name: string): ModelInfo => ({
  id,
  name,
  provider: "google",
  family: "gemini",
  stage: "stable",
  description: "Test model",
  contextWindow: { input: 32000, output: 2048 },
  capabilities: {
    imageInput: false,
    videoInput: false,
    audioInput: false,
    textGeneration: true,
    imageGeneration: false,
    videoGeneration: false,
    speechGeneration: false,
    functionCalling: true,
    codeExecution: true,
    systemInstruction: true,
    thinking: false,
  },
});

export const mockModels = [
  createMockModel("gemini-pro", "Gemini Pro"),
  createMockModel("m2", "Model 2"),
];

// ---------------------------------------------------------------------------
// Shared conversation factory
// ---------------------------------------------------------------------------

import type { Conversation } from "@/db";

export const createMockConv = (
  id: string,
  title: string,
  overrides: Partial<Conversation> = {},
): Conversation => ({
  id,
  title,
  messages: [],
  modelId: "gemini-pro",
  parameters: {
    temperature: 0.7,
    maxTokens: 1024,
    topP: 0.9,
  },
  createdAt: Date.now(),
  updatedAt: Date.now(),
  persisted: true,
  ...overrides,
});

// ---------------------------------------------------------------------------
// Standard beforeEach / afterEach
// ---------------------------------------------------------------------------

export function setupChatTests() {
  beforeEach(async () => {
    vi.clearAllMocks();
    useConversationStore.setState({
      conversations: [],
      activeConversationId: null,
      isLoading: false,
      error: null,
      searchQuery: "",
      isSearching: false,
      isSelectionMode: false,
      selectedIds: [],
      availableModels: mockModels,
    });

    useSettingsStore.setState({
      settings: {
        id: "app-settings",
        apiKeys: { google: "test-api-key" },
        defaultModel: "gemini-pro",
        defaultParameters: { temperature: 0.7, maxTokens: 1024, topP: 0.9 },
        uiPreferences: {
          theme: "system",
          fontSize: "medium",
          codeTheme: "github-dark",
          showTokenCount: true,
          showCostEstimate: true,
        },
      },
      isLoading: false,
      error: null,
    });

    useUIStore.setState({
      isChatSettingsOpen: false,
      isSidebarOpen: true,
    });
  });
}

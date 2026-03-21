import { useConversationStore } from "@/features/chat";
import { useFunctionsStore } from "@/features/functions";
import { useMediaQuery } from "@/shared/hooks";
import { useUIStore } from "@/shared/store/ui";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ChatSettings } from "../ChatSettings";

// Mock the stores and hooks
vi.mock("@/shared/store/ui", () => ({
  useUIStore: vi.fn(),
}));
vi.mock("@/features/chat", () => ({
  useConversationStore: vi.fn(),
}));
vi.mock("@/features/functions", () => ({
  useFunctionsStore: vi.fn(),
}));
vi.mock("@/shared/hooks", () => ({
  useMediaQuery: vi.fn(),
}));

// Mock sub-components to isolate ChatSettings
vi.mock("../ModelSelector", () => ({
  ModelSelector: () => <div data-testid="model-selector" />,
}));
vi.mock("../ParameterControl", () => ({
  ParameterControl: () => <div data-testid="parameter-control" />,
}));
vi.mock("../SystemPromptSection", () => ({
  SystemPromptSection: () => <div data-testid="system-prompt-section" />,
}));

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(function (
  this: ResizeObserver,
) {
  this.observe = vi.fn();
  this.unobserve = vi.fn();
  this.disconnect = vi.fn();
});

describe("ChatSettings", () => {
  const mockSetParameters = vi.fn();
  const mockToggleChatSettings = vi.fn();
  const mockSetChatSettingsOpen = vi.fn();
  const mockEnsureFunctionsLoaded = vi.fn();
  const mockToggleFunctionAttachment = vi.fn();
  const mockSetFunctionCallingMode = vi.fn();
  const mockSetPlatformView = vi.fn();
  const mockSelectFunction = vi.fn();

  const defaultConversation = {
    id: "conv-1",
    modelId: "model-1",
    parameters: { temperature: 0.7, topP: 1, topK: 40, maxTokens: 2048 },
    systemPrompt: "test prompt",
    functionIds: ["fn-1"],
    functionCallingMode: "AUTO",
  };

  const defaultModel = {
    id: "model-1",
    name: "Model 1",
    contextWindow: { output: 4096 },
    capabilities: { systemInstruction: true, functionCalling: true },
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Default UI Store mock
    vi.mocked(useUIStore).mockImplementation(((
      selector: (s: unknown) => unknown,
    ) =>
      selector({
        isChatSettingsOpen: true,
        toggleChatSettings: mockToggleChatSettings,
        setChatSettingsOpen: mockSetChatSettingsOpen,
        setPlatformView: mockSetPlatformView,
        selectFunction: mockSelectFunction,
      })) as unknown as typeof useUIStore);

    // Default Conversation Store mock
    vi.mocked(useConversationStore).mockImplementation(((
      selector: (s: unknown) => unknown,
    ) =>
      selector({
        activeConversationId: "conv-1",
        conversations: [defaultConversation],
        availableModels: [defaultModel],
        setParameters: mockSetParameters,
        setSystemPrompt: vi.fn(),
        toggleFunctionAttachment: mockToggleFunctionAttachment,
        setFunctionCallingMode: mockSetFunctionCallingMode,
      })) as unknown as typeof useConversationStore);

    // Default Functions Store mock
    vi.mocked(useFunctionsStore).mockImplementation(((
      selector: (s: unknown) => unknown,
    ) =>
      selector({
        functions: [{ id: "fn-1", name: "Test Function", description: "Desc" }],
        ensureFunctionsLoaded: mockEnsureFunctionsLoaded,
        isLoading: false,
      })) as unknown as typeof useFunctionsStore);

    // Default Media Query mock (desktop)
    vi.mocked(useMediaQuery).mockReturnValue(true);
  });

  it("handles parameter reset", async () => {
    render(<ChatSettings />);

    const resetBtn = screen.getByRole("button", { name: /reset parameters/i });
    fireEvent.click(resetBtn);

    expect(mockSetParameters).toHaveBeenCalled();
  });

  it("handles function attachment toggle", async () => {
    render(<ChatSettings />);

    const checkbox = screen.getAllByRole("checkbox")[0];
    fireEvent.click(checkbox);

    expect(mockToggleFunctionAttachment).toHaveBeenCalled();
  });

  it("handles 'New' function button click", async () => {
    render(<ChatSettings />);

    const newBtn = screen.getByRole("button", { name: /new/i });
    fireEvent.click(newBtn);

    expect(mockSelectFunction).toHaveBeenCalledWith(null);
    expect(mockSetPlatformView).toHaveBeenCalledWith("functions");
  });

  it("returns null if not open in desktop", () => {
    vi.mocked(useUIStore).mockImplementation(((
      selector: (s: unknown) => unknown,
    ) =>
      selector({
        isChatSettingsOpen: false,
        toggleChatSettings: mockToggleChatSettings,
      })) as unknown as typeof useUIStore);
    const { container } = render(<ChatSettings />);
    expect(container.firstChild).toBeNull();
  });
});

import { Compartment, EditorState } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createEditor,
  reconfigureReadOnly,
  reconfigureTheme,
} from "../codeMirror";

// Mock ALL CodeMirror modules correctly
vi.mock("@codemirror/state", () => ({
  EditorState: {
    create: vi.fn().mockReturnValue({}),
    readOnly: { of: vi.fn().mockReturnValue({}) },
    allowMultipleSelections: { of: vi.fn().mockReturnValue({}) },
  },
  Compartment: vi.fn().mockImplementation(function (this: Compartment) {
    this.of = vi.fn().mockReturnValue({ _isExtension: true });
    this.reconfigure = vi.fn().mockReturnValue({ _isEffect: true });
  }),
}));

vi.mock("@codemirror/view", () => {
  const EditorView = vi.fn().mockImplementation(function (
    this: EditorView,
    args: { state: EditorState; parent: HTMLElement },
  ) {
    Object.defineProperties(this, {
      state: { value: args.state, writable: true },
      parent: { value: args.parent, writable: true },
      dispatch: { value: vi.fn(), writable: true },
      destroy: { value: vi.fn(), writable: true },
    });
  });

  Object.assign(EditorView, {
    updateListener: {
      of: vi.fn().mockReturnValue({ _isExtension: true }),
    },
    theme: vi.fn().mockReturnValue({ _isExtension: true }),
  });

  return {
    EditorView,
    lineNumbers: vi.fn().mockReturnValue({ _isExtension: true }),
    highlightActiveLineGutter: vi.fn().mockReturnValue({ _isExtension: true }),
    highlightSpecialChars: vi.fn().mockReturnValue({ _isExtension: true }),
    drawSelection: vi.fn().mockReturnValue({ _isExtension: true }),
    dropCursor: vi.fn().mockReturnValue({ _isExtension: true }),
    highlightActiveLine: vi.fn().mockReturnValue({ _isExtension: true }),
    crosshairCursor: vi.fn().mockReturnValue({ _isExtension: true }),
    keymap: { of: vi.fn().mockReturnValue({ _isExtension: true }) },
    placeholder: vi.fn().mockReturnValue({ _isExtension: true }),
  };
});

vi.mock("@codemirror/autocomplete", () => ({
  acceptCompletion: vi.fn(),
  autocompletion: vi.fn().mockReturnValue({ _isExtension: true }),
  closeBrackets: vi.fn().mockReturnValue({ _isExtension: true }),
}));

vi.mock("@codemirror/commands", () => ({
  defaultKeymap: [],
  history: vi.fn().mockReturnValue({ _isExtension: true }),
  historyKeymap: [],
}));

vi.mock("@codemirror/lang-javascript", () => ({
  javascript: vi.fn().mockReturnValue({ _isExtension: true }),
}));

vi.mock("@codemirror/language", () => ({
  defaultHighlightStyle: {},
  syntaxHighlighting: vi.fn().mockReturnValue({ _isExtension: true }),
  bracketMatching: vi.fn().mockReturnValue({ _isExtension: true }),
}));

vi.mock("@uiw/codemirror-theme-github", () => ({
  githubDarkInit: vi.fn().mockReturnValue({ _isExtension: true }),
  githubLightInit: vi.fn().mockReturnValue({ _isExtension: true }),
}));

describe("codeMirror utils", () => {
  let parent: HTMLDivElement;

  beforeEach(() => {
    parent = document.createElement("div");
    document.body.appendChild(parent);
    vi.clearAllMocks();
  });

  it("creates an editor with basic setup", async () => {
    const onUpdate = vi.fn();
    const { view, compartments } = await createEditor({
      parent,
      doc: "const x = 1;",
      isDark: true,
      readOnly: false,
      placeholder: "type here...",
      onUpdate,
    });

    expect(view).toBeDefined();
    expect(compartments).toBeDefined();
    // In our mock, Compartment is a constructor
    const { Compartment } = await import("@codemirror/state");
    expect(Compartment).toHaveBeenCalled();
  });

  it("reconfigures theme", async () => {
    const { view, compartments } = await createEditor({
      parent,
      doc: "",
      isDark: false,
      readOnly: false,
      onUpdate: vi.fn(),
    });

    reconfigureTheme(view as unknown as EditorView, compartments, true);
    expect(view.dispatch).toHaveBeenCalled();
  });

  it("reconfigures readOnly", async () => {
    const { view, compartments } = await createEditor({
      parent,
      doc: "",
      isDark: false,
      readOnly: false,
      onUpdate: vi.fn(),
    });

    reconfigureReadOnly(view as unknown as EditorView, compartments, true);
    expect(view.dispatch).toHaveBeenCalled();
  });
});

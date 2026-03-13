import { render, screen } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  type ReactNode,
} from "react";
import { describe, expect, it, vi } from "vitest";

import type { CodeEditorHandle, CodeEditorProps } from "../types";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

/**
 * Stub that replaces the lazy inner CodeMirror component.
 * Props are serialised to data-* attributes so tests can read them without
 * any external mutation (which the React compiler lint rule forbids).
 */
const StubInner = forwardRef<CodeEditorHandle, CodeEditorProps>(
  function StubInner(props, ref) {
    useImperativeHandle(ref, () => ({
      getValue: () => props.value ?? "",
      focus: vi.fn(),
    }));
    // Call onChange once on mount — simulates a CodeMirror document update.
    // useEffect bodies are exempt from the React compiler's external-mutation rule.
    const onChange = props.onChange;
    useEffect(() => {
      onChange?.("codemirror-update");
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);
    return (
      <div
        data-testid="codemirror-editor"
        data-readonly={String(props.readOnly ?? false)}
        data-value={props.value ?? ""}
        data-classname={props.className ?? ""}
        data-placeholder={props.placeholder ?? ""}
      />
    );
  },
);

/**
 * A single lazy promise wrapping StubInner.
 *
 * React.lazy calls `import()` ONCE and caches the result forever.  We must
 * therefore resolve this promise at most once.  Tests that need the editor
 * to be already-rendered wait for it to appear; tests that check the
 * skeleton run before we call `resolveLazy`.
 */
let resolveLazy!: (m: { default: typeof StubInner }) => void;
const lazyPromise = new Promise<{ default: typeof StubInner }>((resolve) => {
  resolveLazy = resolve;
});

vi.mock("./CodeEditorInner", () => lazyPromise);

vi.mock("next-themes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-themes")>();
  return { ...actual, useTheme: vi.fn(() => ({ resolvedTheme: "dark" })) };
});

// ---------------------------------------------------------------------------
// Wrapper with ThemeProvider
// ---------------------------------------------------------------------------
function Wrapper({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>;
}

// ---------------------------------------------------------------------------
// Re-import CodeEditor after mocks are in place
// ---------------------------------------------------------------------------
const { default: CodeEditor } = await import("./CodeEditor");

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CodeEditor", () => {
  // ── 1. Skeleton (must run first, before resolveLazy is called) ───────────
  it("shows the skeleton placeholder while the inner component is loading", () => {
    render(
      <Wrapper>
        <CodeEditor value="const x = 1;" />
      </Wrapper>,
    );

    expect(screen.getByText(/loading editor/i)).toBeInTheDocument();
    expect(screen.queryByTestId("codemirror-editor")).not.toBeInTheDocument();
  });

  // ── 2. Resolve the lazy module ONCE ──────────────────────────────────────
  // All tests from here on will see the already-resolved StubInner.
  it("renders the editor after the lazy chunk resolves", async () => {
    render(
      <Wrapper>
        <CodeEditor value="const x = 1;" />
      </Wrapper>,
    );

    // Resolve the dynamic import, then wait for Suspense to re-render
    resolveLazy({ default: StubInner });
    const el = await screen.findByTestId("codemirror-editor");

    expect(el).toBeInTheDocument();
    expect(screen.queryByText(/loading editor/i)).not.toBeInTheDocument();
  });

  // ── 3+ After resolution — React.lazy returns the stub synchronously ──────

  it("forwards value prop to the inner editor", async () => {
    render(
      <Wrapper>
        <CodeEditor value="console.log('hello')" />
      </Wrapper>,
    );

    const el = await screen.findByTestId("codemirror-editor");
    expect(el).toHaveAttribute("data-value", "console.log('hello')");
  });

  it("passes readOnly=true to the inner editor", async () => {
    render(
      <Wrapper>
        <CodeEditor value="// locked" readOnly />
      </Wrapper>,
    );

    const el = await screen.findByTestId("codemirror-editor");
    expect(el).toHaveAttribute("data-readonly", "true");
  });

  it("wires onChange through and calls it when the inner editor fires", async () => {
    const onChange = vi.fn();

    render(
      <Wrapper>
        <CodeEditor value="" onChange={onChange} />
      </Wrapper>,
    );

    // StubInner calls onChange("codemirror-update") in its mount effect
    await screen.findByTestId("codemirror-editor");
    expect(onChange).toHaveBeenCalledWith("codemirror-update");
  });

  it("exposes getValue() via the forwarded ref", async () => {
    const ref = React.createRef<CodeEditorHandle>();

    render(
      <Wrapper>
        <CodeEditor ref={ref} value="const answer = 42;" />
      </Wrapper>,
    );

    await screen.findByTestId("codemirror-editor");

    expect(ref.current).not.toBeNull();
    expect(ref.current!.getValue()).toBe("const answer = 42;");
  });

  it("passes className through to the inner editor", async () => {
    render(
      <Wrapper>
        <CodeEditor value="" className="my-custom-class" />
      </Wrapper>,
    );

    const el = await screen.findByTestId("codemirror-editor");
    expect(el).toHaveAttribute("data-classname", "my-custom-class");
  });

  it("passes placeholder through to the inner editor", async () => {
    render(
      <Wrapper>
        <CodeEditor value="" placeholder="// Write your function here…" />
      </Wrapper>,
    );

    const el = await screen.findByTestId("codemirror-editor");
    expect(el).toHaveAttribute(
      "data-placeholder",
      "// Write your function here…",
    );
  });
});

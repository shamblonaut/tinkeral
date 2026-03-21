import { fireEvent, render } from "@testing-library/react";
import { ThemeProvider } from "next-themes";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CodeEditorInnerImpl } from "../CodeEditor";

vi.mock("next-themes", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next-themes")>();
  return { ...actual, useTheme: vi.fn(() => ({ resolvedTheme: "dark" })) };
});

describe("CodeEditorInnerImpl", () => {
  beforeEach(() => {
    // JSDOM doesn't support document.createRange out of the box in the way CodeMirror expects
    if (!document.createRange) {
      document.createRange = () =>
        ({
          setStart: () => {},
          setEnd: () => {},
          commonAncestorContainer: {
            nodeName: "BODY",
            ownerDocument: document,
          },
        }) as unknown as Range;
    }
  });

  it("renders without crashing and initializes CodeMirror", async () => {
    const { container } = render(
      <ThemeProvider>
        <CodeEditorInnerImpl value="const x = 1;" />
      </ThemeProvider>,
    );

    const div = container.querySelector("div");
    expect(div).toHaveClass("bg-background");
  });

  it("handles onBlur when losing focus outside", () => {
    const onBlurMock = vi.fn();
    const { container } = render(
      <ThemeProvider>
        <CodeEditorInnerImpl onBlur={onBlurMock} />
      </ThemeProvider>,
    );

    const div = container.querySelector("div");

    if (div) {
      fireEvent.blur(div, { relatedTarget: document.body });
      expect(onBlurMock).toHaveBeenCalled();
    }
  });
});

import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { Item } from "../ui/item";

if (!HTMLElement.prototype.scrollIntoView) {
  HTMLElement.prototype.scrollIntoView = vi.fn();
}
if (!global.ResizeObserver) {
  global.ResizeObserver = vi.fn().mockImplementation(function (
    this: ResizeObserver,
  ) {
    this.observe = vi.fn();
    this.unobserve = vi.fn();
    this.disconnect = vi.fn();
  });
}

describe("UI Primitives", () => {
  it("supports Item asChild contract", () => {
    render(
      <Item asChild>
        <a href="/test-link">Open</a>
      </Item>,
    );

    const link = screen.getByRole("link", { name: "Open" });
    expect(link).toHaveAttribute("href", "/test-link");
    expect(link).toHaveAttribute("data-slot", "item");
  });
});

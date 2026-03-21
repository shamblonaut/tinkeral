import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { SearchField } from "../SearchField";

describe("SearchField", () => {
  const defaultProps = {
    placeholder: "Search...",
    value: "",
    isSearching: false,
    onChange: vi.fn(),
    onClear: vi.fn(),
    ariaLabel: "search-input",
    clearAriaLabel: "clear-search",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("calls onChange when typing", async () => {
    const user = userEvent.setup();
    render(<SearchField {...defaultProps} />);

    const input = screen.getByPlaceholderText("Search...");
    await user.type(input, "test");

    expect(defaultProps.onChange).toHaveBeenCalledWith("t");
  });

  it("renders clear button and calls onClear when value exists", async () => {
    const user = userEvent.setup();
    render(<SearchField {...defaultProps} value="some text" />);

    const clearBtn = screen.getByLabelText("clear-search");
    expect(clearBtn).toBeInTheDocument();

    await user.click(clearBtn);
    expect(defaultProps.onClear).toHaveBeenCalled();
  });

  it("does not render clear button when isSearching is true even if value exists", () => {
    render(<SearchField {...defaultProps} value="text" isSearching={true} />);
    expect(screen.queryByLabelText("clear-search")).not.toBeInTheDocument();
  });
});

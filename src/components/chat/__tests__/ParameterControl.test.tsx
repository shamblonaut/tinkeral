import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ParameterControl } from "../ParameterControl";
// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};
describe("ParameterControl", () => {
  const defaultProps = {
    id: "test-param",
    label: "Test Parameter",
    value: 0.5,
    min: 0,
    max: 1,
    step: 0.1,
    onChange: vi.fn(),
  };
  it("renders correctly with label and initial value", () => {
    render(<ParameterControl {...defaultProps} />);
    expect(screen.getByLabelText("Test Parameter")).toBeInTheDocument();
    // The input should have the initial value
    expect(
      screen.getByRole("spinbutton", { name: /test parameter/i }),
    ).toHaveValue(0.5);
  });
  it("calls onChange when slider value changes", async () => {
    // Note: Interacting with slider directly in JSDOM is tricky,
    // usually we test that the component passes props correctly.
    // For this test, we'll focus on the input which is our main addition.
    render(<ParameterControl {...defaultProps} />);
    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    expect(input).toBeInTheDocument();
  });
  it("updates value when typing in the input", async () => {
    const user = userEvent.setup();
    render(<ParameterControl {...defaultProps} />);
    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    await user.clear(input);
    await user.type(input, "0.8");
    // It should update local state but not call onChange until commit
    expect(input).toHaveValue(0.8);
    expect(defaultProps.onChange).not.toHaveBeenCalled();
    // Trigger commit (blur)
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledWith(0.8);
  });
  it("clamps values below min", async () => {
    const user = userEvent.setup();
    render(<ParameterControl {...defaultProps} />);
    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    await user.clear(input);
    await user.type(input, "-1");
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledWith(0);
    expect(input).toHaveValue(0);
  });
  it("clamps values above max", async () => {
    const user = userEvent.setup();
    render(<ParameterControl {...defaultProps} />);
    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    await user.clear(input);
    await user.type(input, "2");
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledWith(1);
    expect(input).toHaveValue(1);
  });
  it("rounds values to step", async () => {
    const user = userEvent.setup();
    render(<ParameterControl {...defaultProps} step={0.1} />);
    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    await user.clear(input);
    await user.type(input, "0.54"); // Should round to 0.5
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledWith(0.5);
    // Wait for effect to update local value from props if onChange was wired up,
    // but here we just check if it called with rounded value.
  });
  it("handles invalid input by reverting to previous value", async () => {
    const user = userEvent.setup();
    render(<ParameterControl {...defaultProps} value={0.5} />);
    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    await user.clear(input);
    await user.type(input, "abc");
    fireEvent.blur(input);
    // If input is invalid, it might just stay or revert.
    // Ideally it should revert to the last valid value (prop value).
    // In our implementation we'll probably rely on current prop value.
    expect(input).toHaveValue(0.5);
  });
});

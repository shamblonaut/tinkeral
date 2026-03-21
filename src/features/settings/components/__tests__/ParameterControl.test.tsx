import { fireEvent, render, screen } from "@testing-library/react";
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

  it("commits typed values on blur", () => {
    render(<ParameterControl {...defaultProps} />);

    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    fireEvent.change(input, { target: { value: "0.8" } });

    expect(defaultProps.onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(defaultProps.onChange).toHaveBeenCalledWith(0.8);
  });

  it("clamps out-of-range values", () => {
    render(<ParameterControl {...defaultProps} />);

    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    fireEvent.change(input, { target: { value: "2" } });
    fireEvent.blur(input);

    expect(defaultProps.onChange).toHaveBeenCalledWith(1);
    expect(input).toHaveValue(1);
  });

  it("rounds values to step precision", () => {
    render(<ParameterControl {...defaultProps} />);

    const input = screen.getByRole("spinbutton", { name: /test parameter/i });
    fireEvent.change(input, { target: { value: "0.54" } });
    fireEvent.blur(input);

    expect(defaultProps.onChange).toHaveBeenCalledWith(0.5);
  });
});

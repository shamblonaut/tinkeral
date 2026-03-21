import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DescriptionField,
  NameField,
  TimeoutField,
} from "../FunctionSettingsFields";

describe("FunctionSettingsFields", () => {
  describe("NameField", () => {
    it("renders and handles changes", async () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      const user = userEvent.setup();

      render(
        <NameField
          value="old_name"
          onChange={onChange}
          onBlur={onBlur}
          disabled={false}
        />,
      );

      const input = screen.getByLabelText(/Name/i);
      expect(input).toHaveValue("old_name");

      await user.type(input, "_new");
      expect(onChange).toHaveBeenCalled();

      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalledWith("old_name");
    });

    it("displays error message", () => {
      render(
        <NameField
          value=""
          onChange={vi.fn()}
          onBlur={vi.fn()}
          disabled={false}
          error="Name is required"
        />,
      );
      expect(screen.getByText("Name is required")).toBeInTheDocument();
    });
  });

  describe("DescriptionField", () => {
    it("renders and handles changes", async () => {
      const onChange = vi.fn();
      const user = userEvent.setup();

      render(
        <DescriptionField
          value="old desc"
          onChange={onChange}
          disabled={false}
        />,
      );

      const textarea = screen.getByLabelText(/Description/i);
      expect(textarea).toHaveValue("old desc");

      await user.type(textarea, " new");
      expect(onChange).toHaveBeenCalled();
    });
  });

  describe("TimeoutField", () => {
    it("renders and handles changes", async () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      const user = userEvent.setup();

      render(
        <TimeoutField
          value={1000}
          onChange={onChange}
          onBlur={onBlur}
          disabled={false}
        />,
      );

      const input = screen.getByLabelText(/Timeout/i);
      expect(input).toHaveValue(1000);

      await user.type(input, "0");
      expect(onChange).toHaveBeenCalled();

      fireEvent.blur(input);
      expect(onBlur).toHaveBeenCalledWith(1000);
    });

    it("displays error message", () => {
      render(
        <TimeoutField
          value={0}
          onChange={vi.fn()}
          onBlur={vi.fn()}
          disabled={false}
          error="Timeout too low"
        />,
      );
      expect(screen.getByText("Timeout too low")).toBeInTheDocument();
    });
  });
});

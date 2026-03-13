import { fireEvent, render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { JSONSchema } from "@/types";

interface PointerCaptureEventTarget {
  hasPointerCapture?: () => boolean;
  setPointerCapture?: () => void;
  releasePointerCapture?: () => void;
}

const targetProto = window.EventTarget.prototype as PointerCaptureEventTarget;

if (typeof targetProto.hasPointerCapture !== "function") {
  targetProto.hasPointerCapture = () => false;
  targetProto.setPointerCapture = () => {};
  targetProto.releasePointerCapture = () => {};
}

import { ParameterSchemaEditor } from "./ParameterSchemaEditor";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emptySchema(): JSONSchema {
  return { type: "object", properties: {} };
}

function singleParamSchema(): JSONSchema {
  return {
    type: "object",
    properties: {
      location: { type: "string", description: "City name" },
    },
    required: ["location"],
  };
}

function multiParamSchema(): JSONSchema {
  return {
    type: "object",
    properties: {
      query: { type: "string", description: "Search query" },
      limit: { type: "number" },
      enabled: { type: "boolean" },
    },
    required: ["query"],
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ParameterSchemaEditor", () => {
  // ── Empty state ───────────────────────────────────────────────────────────
  describe("empty schema", () => {
    it("shows the empty state message", () => {
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={vi.fn()} />,
      );
      expect(screen.getByText(/no parameters defined/i)).toBeInTheDocument();
    });

    it("renders the 'Add Parameter' button", () => {
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={vi.fn()} />,
      );
      expect(
        screen.getByRole("button", { name: /add parameter/i }),
      ).toBeInTheDocument();
    });
  });

  // ── Rendering existing params ─────────────────────────────────────────────
  describe("rendering existing parameters", () => {
    it("renders a row for each property", () => {
      render(
        <ParameterSchemaEditor
          schema={multiParamSchema()}
          onChange={vi.fn()}
        />,
      );
      const nameInputs = screen.getAllByPlaceholderText("param_name");
      expect(nameInputs).toHaveLength(3);
    });

    it("populates the name input from the property key", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByDisplayValue("location")).toBeInTheDocument();
    });

    it("populates the description input from the property description", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
        />,
      );
      expect(screen.getByDisplayValue("City name")).toBeInTheDocument();
    });

    it("populates the type selector from the property type", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
        />,
      );
      const typeSelect = screen.getByRole("combobox", {
        name: /parameter 1 type/i,
      });
      expect(typeSelect).toHaveTextContent("string");
    });

    it("checks the required checkbox for required properties", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
        />,
      );
      const checkbox = screen.getByRole("checkbox", {
        name: /parameter 1 required/i,
      });
      expect(checkbox).toBeChecked();
    });

    it("does not check the required checkbox for optional properties", () => {
      render(
        <ParameterSchemaEditor
          schema={multiParamSchema()}
          onChange={vi.fn()}
        />,
      );
      // "limit" is not in required
      const limitRow = screen
        .getAllByPlaceholderText("param_name")
        .find((el) => (el as HTMLInputElement).value === "limit")!
        .closest("div.border")!;
      const checkbox = within(limitRow as HTMLElement).getByRole("checkbox");
      expect(checkbox).not.toBeChecked();
    });

    it("hides the empty-state message when there are rows", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
        />,
      );
      expect(
        screen.queryByText(/no parameters defined/i),
      ).not.toBeInTheDocument();
    });
  });

  // ── Add parameter ─────────────────────────────────────────────────────────
  describe("adding a parameter", () => {
    it("keeps the new row visible in a controlled parent after clicking add", () => {
      function ControlledEditor() {
        const [schema, setSchema] = useState<JSONSchema>(emptySchema());
        return <ParameterSchemaEditor schema={schema} onChange={setSchema} />;
      }

      render(<ControlledEditor />);

      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));

      expect(screen.getByPlaceholderText("param_name")).toBeInTheDocument();
    });

    it("calls onChange when 'Add Parameter' is clicked and a name is typed", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={onChange} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));

      const nameInput = screen.getByPlaceholderText("param_name");
      fireEvent.change(nameInput, { target: { value: "newParam" } });
      fireEvent.blur(nameInput);

      const updated: JSONSchema =
        onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(Object.keys(updated.properties)).toHaveLength(1);
    });

    it("new row defaults type to 'string'", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={onChange} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));

      const nameInput = screen.getByPlaceholderText("param_name");
      fireEvent.change(nameInput, { target: { value: "newParam" } });
      fireEvent.blur(nameInput);

      const updated: JSONSchema =
        onChange.mock.calls[onChange.mock.calls.length - 1][0];
      const prop = Object.values(updated.properties)[0];
      expect(prop.type).toBe("string");
    });

    it("new row is not required by default", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={onChange} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));

      const nameInput = screen.getByPlaceholderText("param_name");
      fireEvent.change(nameInput, { target: { value: "newParam" } });
      fireEvent.blur(nameInput);

      const updated: JSONSchema =
        onChange.mock.calls[onChange.mock.calls.length - 1][0];
      expect(updated.required ?? []).not.toContain(
        Object.keys(updated.properties)[0],
      );
    });

    it("removes an empty parameter row on blur", () => {
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={vi.fn()} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));

      const nameInput = screen.getByPlaceholderText("param_name");
      fireEvent.blur(nameInput);

      expect(
        screen.queryByPlaceholderText("param_name"),
      ).not.toBeInTheDocument();
    });

    it("does not add another row while an empty parameter exists", () => {
      render(
        <ParameterSchemaEditor schema={emptySchema()} onChange={vi.fn()} />,
      );

      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));
      fireEvent.click(screen.getByRole("button", { name: /add parameter/i }));

      const nameInputs = screen.getAllByPlaceholderText("param_name");
      expect(nameInputs).toHaveLength(1);
    });
  });

  // ── Editing fields ────────────────────────────────────────────────────────
  describe("editing a parameter row", () => {
    it("calls onChange with updated property key when name changes", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      const nameInput = screen.getByDisplayValue("location");
      fireEvent.change(nameInput, { target: { value: "city" } });
      fireEvent.blur(nameInput);

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(Object.keys(updated.properties)).toContain("city");
      expect(Object.keys(updated.properties)).not.toContain("location");
    });

    it("preserves required state under the new key name", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByDisplayValue("location"), {
        target: { value: "city" },
      });
      fireEvent.blur(screen.getByDisplayValue("city"));

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.required).toContain("city");
    });

    it("calls onChange with updated description", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByDisplayValue("City name"), {
        target: { value: "The city to look up" },
      });
      fireEvent.blur(screen.getByDisplayValue("The city to look up"));

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.properties["location"].description).toBe(
        "The city to look up",
      );
    });

    it("calls onChange when description is cleared (no description key in output)", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      fireEvent.change(screen.getByDisplayValue("City name"), {
        target: { value: "" },
      });
      fireEvent.blur(screen.getByPlaceholderText("Optional description"));

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.properties["location"].description).toBeUndefined();
    });

    it("adds property to required array when checkbox is checked", () => {
      const onChange = vi.fn();
      // Use multiParam where "limit" is not required
      render(
        <ParameterSchemaEditor
          schema={multiParamSchema()}
          onChange={onChange}
        />,
      );

      const limitRow = screen
        .getAllByPlaceholderText("param_name")
        .find((el) => (el as HTMLInputElement).value === "limit")!
        .closest("div.border")!;
      const checkbox = within(limitRow as HTMLElement).getByRole("checkbox");

      fireEvent.click(checkbox);
      fireEvent.blur(checkbox);

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.required).toContain("limit");
    });

    it("removes property from required array when checkbox is unchecked", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      const checkbox = screen.getByRole("checkbox", {
        name: /parameter 1 required/i,
      });
      fireEvent.click(checkbox);
      fireEvent.blur(checkbox);

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.required ?? []).not.toContain("location");
    });
  });

  // ── Remove parameter ──────────────────────────────────────────────────────
  describe("removing a parameter", () => {
    it("calls onChange without the removed property", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /remove parameter location/i }),
      );

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(Object.keys(updated.properties)).not.toContain("location");
    });

    it("also removes the property from the required array on delete", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /remove parameter location/i }),
      );

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.required ?? []).not.toContain("location");
    });

    it("removes only the targeted row when multiple params exist", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={multiParamSchema()}
          onChange={onChange}
        />,
      );

      fireEvent.click(
        screen.getByRole("button", { name: /remove parameter query/i }),
      );

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(Object.keys(updated.properties)).not.toContain("query");
      expect(Object.keys(updated.properties)).toContain("limit");
      expect(Object.keys(updated.properties)).toContain("enabled");
    });
  });

  // ── Disabled state ────────────────────────────────────────────────────────
  describe("disabled state", () => {
    it("disables the Add Parameter button when disabled=true", () => {
      render(
        <ParameterSchemaEditor
          schema={emptySchema()}
          onChange={vi.fn()}
          disabled
        />,
      );
      expect(
        screen.getByRole("button", { name: /add parameter/i }),
      ).toBeDisabled();
    });

    it("disables all row inputs when disabled=true", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
          disabled
        />,
      );
      const nameInput = screen.getByDisplayValue("location");
      expect(nameInput).toBeDisabled();
    });

    it("disables the remove button when disabled=true", () => {
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={vi.fn()}
          disabled
        />,
      );
      expect(
        screen.getByRole("button", { name: /remove parameter location/i }),
      ).toBeDisabled();
    });
  });

  // ── Schema roundtrip ──────────────────────────────────────────────────────
  describe("schema roundtrip integrity", () => {
    it("preserves all property types across add+rename cycle", () => {
      const onChange = vi.fn();
      render(
        <ParameterSchemaEditor
          schema={multiParamSchema()}
          onChange={onChange}
        />,
      );

      // Rename "enabled" to "active"
      const enabledInput = screen.getByDisplayValue("enabled");
      fireEvent.change(enabledInput, { target: { value: "active" } });
      fireEvent.blur(enabledInput);

      const updated: JSONSchema = onChange.mock.calls[0][0];
      expect(updated.properties["active"].type).toBe("boolean");
    });

    it("does not include required key in output when no required params", () => {
      const onChange = vi.fn();
      // Start with a required param and uncheck it
      render(
        <ParameterSchemaEditor
          schema={singleParamSchema()}
          onChange={onChange}
        />,
      );
      const checkbox = screen.getByRole("checkbox", { name: /required/i });
      fireEvent.click(checkbox);
      fireEvent.blur(checkbox);

      const updated: JSONSchema = onChange.mock.calls[0][0];
      // required should either be absent or empty
      expect(
        updated.required === undefined || updated.required.length === 0,
      ).toBe(true);
    });
  });
});

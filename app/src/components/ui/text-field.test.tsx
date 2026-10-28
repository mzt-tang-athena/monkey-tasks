import * as React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TextField } from "./text-field";

describe("TextField", () => {
  it("is named by its label", () => {
    render(<TextField label="Due" value="" onChangeText={vi.fn()} placeholder="2026-10-21" />);

    expect(screen.getByRole("textbox", { name: "Due" })).toBeTruthy();
  });

  it("is described by its hint", () => {
    render(<TextField label="Lists" hint="One list name per line." value="" multiline />);

    const input = screen.getByRole("textbox", { name: "Lists" });
    const note = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(note?.textContent).toBe("One list name per line.");
    expect(input.getAttribute("aria-invalid")).toBe("false");
  });

  it("shows an error in place of the hint and marks the input invalid", () => {
    render(
      <TextField label="Name" hint="The note's file name." error="A task needs a name." value="" />,
    );

    const input = screen.getByRole("textbox", { name: "Name" });
    expect(input.getAttribute("aria-invalid")).toBe("true");
    const note = document.getElementById(input.getAttribute("aria-describedby")!);
    expect(note?.textContent).toBe("A task needs a name.");
    expect(screen.queryByText("The note's file name.")).toBeNull();
  });

  it("reports each change", () => {
    const onChangeText = vi.fn();
    render(<TextField label="Name" value="" onChangeText={onChangeText} />);

    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Call Mum" },
    });

    expect(onChangeText).toHaveBeenCalledWith("Call Mum");
  });

  it("takes many lines when asked", () => {
    render(<TextField label="Body" value="" multiline />);

    expect(screen.getByRole("textbox", { name: "Body" }).tagName).toBe("TEXTAREA");
  });
});

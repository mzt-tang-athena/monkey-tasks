import * as React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import { PreviewRow } from "./preview-row";

function task(name: string, extra: Partial<TaskFrontmatter> = {}): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20", ...extra },
    body: "",
  };
}

describe("PreviewRow", () => {
  it("draws no meta line under a name that has nothing to show", () => {
    // The preview must match the live row, which pads its text the
    // same above and below (ADR 0012).
    render(<PreviewRow task={task("Buy milk")} />);

    const block = screen.getByText("Buy milk").parentElement!;
    expect(block.children).toHaveLength(1);
  });

  it("shows the check and no toggle for a done task", () => {
    render(<PreviewRow task={task("Buy milk")} done />);

    expect(screen.getByText("✓")).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

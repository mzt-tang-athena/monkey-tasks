import "@/testing/reduced-motion";
import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { OverlayHost } from "@/components/ui/overlay-host";
import { TaskRow } from "@/components/task-row";
import { CelebrationProvider } from "./celebration";

const uri = "content://vault/Tasks/Buy milk.md";
const item: TaskItem = {
  id: uri,
  uri,
  fileName: "Buy milk.md",
  name: "Buy milk",
  text: "",
  data: { kind: "[[tasks]]", created: "2026-10-20", "alert weight": "harsh" },
  body: "",
};

describe("the completion celebration with reduced motion", () => {
  it("mounts no burst when the user ticks a task", async () => {
    render(
      <OverlayHost>
        <CelebrationProvider>
          <TaskRow task={item} onToggle={vi.fn()} />
        </CelebrationProvider>
      </OverlayHost>,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Buy milk" }));
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 60));
    });

    expect(screen.queryByTestId("tick-burst")).toBeNull();
  });
});

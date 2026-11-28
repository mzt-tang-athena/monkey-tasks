import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import type { ListsSection } from "../lib/list-sections";
import { useTickHold } from "./use-tick-hold";

function task(name: string, completed?: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
      ...(completed ? { completed } : {}),
    },
  };
}

const open: ListsSection[] = [
  { key: "today", title: "Today", tone: "ink", data: [task("A"), task("B")] },
];

describe("useTickHold", () => {
  it("lets go of a held row that leaves the list, because no circle plays to end it", () => {
    const toggle = vi.fn();
    const a = task("A");
    const { result, rerender } = renderHook(
      ({ rows }) => useTickHold(toggle, rows),
      { initialProps: { rows: [a, task("B")] } },
    );

    act(() => result.current.toggle(a, open));
    expect(result.current.holds).toHaveLength(1);

    rerender({ rows: [task("B")] });
    expect(result.current.holds).toHaveLength(0);

    rerender({ rows: [task("A", "2026-10-26T10:00:00"), task("B")] });
    expect(result.current.holds).toHaveLength(0);
  });

  it("keeps a held row that stays in the list while its circle plays", () => {
    const toggle = vi.fn();
    const a = task("A");
    const { result, rerender } = renderHook(
      ({ rows }) => useTickHold(toggle, rows),
      { initialProps: { rows: [a, task("B")] } },
    );

    act(() => result.current.toggle(a, open));
    rerender({ rows: [task("A", "2026-10-26T10:00:00"), task("B")] });

    expect(result.current.holds).toHaveLength(1);
  });
});

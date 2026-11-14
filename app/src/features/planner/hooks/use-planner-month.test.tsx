import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { Source } from "@/features/planner/model";
import type { TaskItem } from "@/types/task";
import { usePlannerMonth } from "./use-planner-month";

function task(name: string, data: TaskFrontmatter | null): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data,
  };
}

function mount(tasks: TaskItem[], source: Source, day: Date) {
  return renderHook(() => usePlannerMonth({ tasks, source, day })).result;
}

const VIEWED = new Date(2026, 9, 22);

describe("usePlannerMonth monthRows", () => {
  it("lists a weekly task stored in the previous month", () => {
    const result = mount(
      [
        task("water plants", {
          kind: "[[tasks]]",
          created: "2026-09-20",
          due: "2026-09-28",
          recurrence: "FREQ=WEEKLY;BYDAY=MO",
        }),
      ],
      "due-period",
      VIEWED,
    );
    expect(result.current.monthRows.map((row) => row.name)).toEqual(["water plants"]);
  });

  it("leaves out a task with no occurrence in the viewed month", () => {
    const result = mount(
      [
        task("pay rent", {
          kind: "[[tasks]]",
          created: "2026-08-01",
          due: "2026-09-01",
        }),
      ],
      "due-period",
      VIEWED,
    );
    expect(result.current.monthRows).toEqual([]);
  });

  it("keeps the named-list filter on the occurrence test", () => {
    const result = mount(
      [
        task("water plants", {
          kind: "[[tasks]]",
          created: "2026-09-20",
          due: "2026-09-28",
          recurrence: "FREQ=WEEKLY;BYDAY=MO",
          list: "[[Focus]]",
        }),
        task("pay rent", {
          kind: "[[tasks]]",
          created: "2026-09-20",
          due: "2026-10-02",
        }),
      ],
      "Focus",
      VIEWED,
    );
    expect(result.current.monthRows.map((row) => row.name)).toEqual(["water plants"]);
  });
});

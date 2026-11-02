import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { TaskItem } from "@/types/task";
import {
  MONTHS,
  MONTHS_SHORT,
  WEEKDAYS,
  WEEKDAYS_FULL,
  labelHour,
  pillDateLabel,
} from "./labels";

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

describe("labelHour", () => {
  it("labels midnight and noon as 12", () => {
    expect(labelHour(0)).toBe("12 AM");
    expect(labelHour(12)).toBe("12 PM");
  });

  it("labels the afternoon with PM", () => {
    expect(labelHour(13)).toBe("1 PM");
    expect(labelHour(23)).toBe("11 PM");
  });
});

describe("pillDateLabel", () => {
  it("shows the short month and day of a dated task", () => {
    const item = task("Pay rent", {
      due: "2026-03-09",
    } as TaskFrontmatter);
    expect(pillDateLabel(item)).toBe("Mar 9");
  });

  it("shows nothing for an undated task", () => {
    expect(pillDateLabel(task("Someday", null))).toBe("");
    expect(pillDateLabel(task("Someday", {} as TaskFrontmatter))).toBe("");
  });
});

describe("calendar labels", () => {
  it("covers a full week and year", () => {
    expect(WEEKDAYS).toHaveLength(7);
    expect(WEEKDAYS_FULL).toHaveLength(7);
    expect(MONTHS).toHaveLength(12);
    expect(MONTHS_SHORT).toHaveLength(12);
  });
});

/* eslint-disable react-hooks/globals */
// The Probe pattern: the test reads the hook result through a module
// binding, which is the shape the rule forbids in app code.
import * as React from "react";
import { act, create } from "react-test-renderer";
import { describe, expect, it } from "vitest";
import type { TaskFrontmatter } from "@monkey-tasks/schemas";
import type { Source } from "../model";
import type { TaskItem } from "../../tasks/query";
import { usePlannerMonth } from "./usePlannerMonth";

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

let latest: { monthRows: TaskItem[] } | null = null;

function Probe(props: {
  tasks: TaskItem[];
  source: Source;
  day: Date;
}): null {
  latest = usePlannerMonth(props);
  return null;
}

async function mount(
  tasks: TaskItem[],
  source: Source,
  day: Date,
): Promise<void> {
  await act(async () => {
    create(React.createElement(Probe, { tasks, source, day }));
  });
}

const VIEWED = new Date(2026, 9, 22);

describe("usePlannerMonth monthRows", () => {
  it("lists a weekly task stored in the previous month", async () => {
    await mount(
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
    expect(latest?.monthRows.map((row) => row.name)).toEqual(["water plants"]);
  });

  it("leaves out a task with no occurrence in the viewed month", async () => {
    await mount(
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
    expect(latest?.monthRows).toEqual([]);
  });

  it("keeps the named-list filter on the occurrence test", async () => {
    await mount(
      [
        task("water plants", {
          kind: "[[tasks]]",
          created: "2026-09-20",
          due: "2026-09-28",
          recurrence: "FREQ=WEEKLY;BYDAY=MO",
          lists: ["[[Focus]]"],
        }),
        task("pay rent", {
          kind: "[[tasks]]",
          created: "2026-09-20",
          due: "2026-10-02",
          lists: ["[[Main]]"],
        }),
      ],
      "Focus",
      VIEWED,
    );
    expect(latest?.monthRows.map((row) => row.name)).toEqual(["water plants"]);
  });
});

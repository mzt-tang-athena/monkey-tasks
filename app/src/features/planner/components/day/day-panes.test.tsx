import * as React from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { TaskItem } from "@/types/task";
import { DropZoneMap } from "@/features/planner/lib/dropzone";
import {
  useDragSession,
  type DragPatch,
} from "@/features/planner/hooks/use-drag-session";
import { TestPlannerList } from "@/features/planner/testing/test-planner-list";
import { DayListPane } from "./day-list-pane";
import { TimelinePane } from "./timeline-pane";

function task(name: string, due: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    body: "",
    data: { kind: "[[tasks]]", created: "2026-10-01", due },
  };
}

const standup = task("Standup", "2026-10-26T09:00");
const tasks = [standup, task("Groceries", "2026-10-26T18:00")];
const date = new Date(2026, 9, 26);
const noOverdue: TaskItem[] = [];
const now = new Date(2026, 9, 26, 9, 5);

function resolve(hit: string): DragPatch | null {
  return hit.startsWith("hour:") ? { due: "2026-10-26T10:00" } : null;
}

type Session = ReturnType<typeof useDragSession>;

/** The day body as the screen builds it: one session, one context, the
    two panes. Each pane sits in a Profiler that counts its commits. */
function Harness({
  zones,
  onCommit,
  onSession,
}: {
  zones: DropZoneMap;
  onCommit: (pane: "timeline" | "list") => void;
  onSession: (session: Session) => void;
}) {
  const write = React.useCallback(() => undefined, []);
  const session = useDragSession({ zones, resolve, write, pointerPickup: false });
  React.useEffect(() => {
    onSession(session);
  });
  return (
    <TestPlannerList
      value={{ lifted: session.lifted, api: session.api, dragStart: session.startDrag }}
    >
      <React.Profiler id="timeline" onRender={() => onCommit("timeline")}>
        <TimelinePane
          tasks={tasks}
          isToday
          now={now}
          height={320}
          drop={session.dropTargets}
        />
      </React.Profiler>
      <React.Profiler id="list" onRender={() => onCommit("list")}>
        <DayListPane date={date} tasks={tasks} overdue={noOverdue} />
      </React.Profiler>
    </TestPlannerList>
  );
}

describe("the day's panes during a drag", () => {
  it("re-renders the timeline, and not the list pane, when the hover changes", () => {
    const zones = new DropZoneMap();
    const counts = { timeline: 0, list: 0 };
    let session: Session | null = null;
    render(
      <Harness
        zones={zones}
        onCommit={(pane) => {
          counts[pane]++;
        }}
        onSession={(next) => {
          session = next;
        }}
      />,
    );
    // A laid-out ruler row, as the device measures it.
    zones.set("hour:10", {
      measureInWindow: (cb) => cb(0, 0, 100, 100),
    });

    // The pickup lifts the row, and both panes show the lift.
    act(() => session!.api.pickup(standup, 500, 500, "row"));
    counts.timeline = 0;
    counts.list = 0;

    // The finger moves onto the 10 AM row, then off it.
    act(() => session!.api.move(50, 50));
    expect(session!.dropTargets.hover.get()).toBe("hour:10");
    act(() => session!.api.move(500, 500));
    expect(session!.dropTargets.hover.get()).toBeNull();

    expect(counts.timeline).toBe(2);
    expect(counts.list).toBe(0);
  });
});

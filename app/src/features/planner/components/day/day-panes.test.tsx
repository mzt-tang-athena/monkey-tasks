import * as React from "react";
import { act, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Text } from "react-native";
import { Split } from "@/components/motion/split";
import type { TaskItem } from "@/types/task";
import { PlanDrag } from "@/features/planner/lib/plan-drag";
import { TestPlannerList } from "@/features/planner/testing/test-planner-list";
import { placeBox } from "@/testing/layout";
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
const tasks = [standup];
const date = new Date(2026, 9, 26);
const noOverdue: TaskItem[] = [];
const now = new Date(2026, 9, 26, 9, 5);

/** A body that reads the drag state, as the day screen's chrome does. */
function Watch({ onRender }: { onRender: () => void }) {
  PlanDrag.useDragging();
  onRender();
  return null;
}

function DayBody({
  onBodyRender,
  onDrop,
}: {
  onBodyRender: () => void;
  onDrop: () => void;
}) {
  return (
    <TestPlannerList>
      <PlanDrag.Root onDrop={onDrop} renderGhost={() => null}>
        <Watch onRender={onBodyRender} />
        <TimelinePane tasks={tasks} isToday now={now} />
        <DayListPane date={date} tasks={[]} overdue={noOverdue} />
      </PlanDrag.Root>
    </TestPlannerList>
  );
}

function pointer(type: string, x: number, y: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: y,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

const wait = (ms: number) => act(() => new Promise<void>((resolve) => setTimeout(resolve, ms)));

function layOutRuler() {
  // The scroller clips its zones: in a browser it is the viewport, and
  // jsdom needs the same box for the hit test.
  placeBox(screen.getByTestId("timeline-scroller"), {
    x: 0,
    y: 0,
    width: 400,
    height: 704,
  });
  for (let hour = 7; hour <= 22; hour++) {
    placeBox(screen.getByTestId(`timeline-hour:${hour}`), {
      x: 0,
      y: (hour - 7) * 44,
      width: 400,
      height: 44,
    });
  }
  placeBox(screen.getByTestId("hour-task:Standup"), {
    x: 56,
    y: 88,
    width: 340,
    height: 40,
  });
}

function dayBody() {
  let body = 0;
  const onDrop = vi.fn();
  render(<DayBody onBodyRender={() => { body++; }} onDrop={onDrop} />);
  return { body: () => body, reset: () => { body = 0; }, onDrop };
}

describe("the day body during a drag", () => {
  it("renders once at the pickup and once at the drop, and no time per move", async () => {
    const { body, reset, onDrop } = dayBody();
    layOutRuler();
    reset();

    const source = screen.getByTestId("hour-task:Standup");
    await act(async () => {
      source.dispatchEvent(pointer("pointerdown", 100, 100));
    });
    await wait(350);
    for (const hour of [10, 11, 12, 13, 14]) {
      await act(async () => {
        source.dispatchEvent(pointer("pointermove", 100, (hour - 7) * 44 + 22));
      });
      await wait(16);
    }
    await act(async () => {
      source.dispatchEvent(pointer("pointerup", 100, (14 - 7) * 44 + 22));
    });
    await wait(50);

    expect(onDrop).toHaveBeenCalledTimes(1);
    expect(body()).toBe(2);
  });
});

describe("the split during a resize", () => {
  it("renders once, at the release, for a 120 px move", async () => {
    const commits = { count: 0 };
    function Harness() {
      const [fraction, setFraction] = React.useState(0.5);
      return (
        <React.Profiler
          id="split"
          onRender={() => {
            commits.count++;
          }}
        >
          <Split
            testID="split"
            fraction={fraction}
            onResize={setFraction}
            minTop={150}
            minBottom={150}
            top={<Text>timeline</Text>}
            bottom={<Text>list</Text>}
          />
        </React.Profiler>
      );
    }
    render(<Harness />);
    placeBox(screen.getByTestId("split"), { x: 0, y: 0, width: 400, height: 628 });
    placeBox(screen.getByTestId("split:top"), { x: 0, y: 0, width: 400, height: 300 });
    placeBox(screen.getByTestId("split:grip"), { x: 164, y: 300, width: 72, height: 28 });
    await wait(50);
    commits.count = 0;

    const grip = screen.getByTestId("split:grip");
    await act(async () => {
      grip.dispatchEvent(pointer("pointerdown", 200, 300));
    });
    for (const y of [340, 380, 420]) {
      await act(async () => {
        grip.dispatchEvent(pointer("pointermove", 200, y));
      });
      await wait(16);
    }
    await act(async () => {
      grip.dispatchEvent(pointer("pointerup", 200, 420));
    });
    await wait(50);

    expect(commits.count).toBe(1);
  });
});

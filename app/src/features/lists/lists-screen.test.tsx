import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { placeBox, setWindowSize } from "@/testing/layout";
import { todayIso } from "@/utils/dates";
import ListsScreen from "./lists-screen";

// The screen's inputs are the store, the router and the settings. The
// task row is a counting stand-in: a row that renders again, or mounts
// again, shows in the counts. The real row is memoized, so the stand-in
// is too.

const spy = vi.hoisted(() => ({
  renders: {} as Record<string, number>,
  mounts: {} as Record<string, number>,
  screenRenders: 0,
  push: vi.fn(),
  tasks: [] as unknown[],
  listeners: new Set<() => void>(),
  sortMode: "due" as "due" | "manual",
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({ router: { push: spy.push } }));

vi.mock("@/lib/settings", () => ({
  loadSettings: () => ({ taskForm: "rows", sortMode: spy.sortMode }),
  saveSetting: () => undefined,
}));

vi.mock("@/components/bottom-bar/bottom-bar", () => ({ BottomBar: () => null }));

// The toolbar renders only when the screen renders, so its count is
// the screen's count. The pager's own state sits below it.
vi.mock("./components/lists-toolbar", () => {
  const Toolbar = () => {
    spy.screenRenders += 1;
    return null;
  };
  return { ListsToolbar: Toolbar };
});

vi.mock("@/stores/tasks/task-state", async () => {
  const React = await import("react");
  const subscribe = (listener: () => void) => {
    spy.listeners.add(listener);
    return () => spy.listeners.delete(listener);
  };
  const meta = {
    rootUri: "root",
    status: "ready",
    readError: null,
    brokenLists: [],
    lists: ["Errands"],
  };
  return {
    useTaskList: () =>
      React.useSyncExternalStore(subscribe, () => spy.tasks) as TaskItem[],
    useStoreMeta: () => meta,
  };
});

vi.mock("@/stores/tasks/mutations/use-toggle-task", () => ({
  useToggleTask: () => async (task: TaskItem) => {
    spy.tasks = (spy.tasks as TaskItem[]).map((item) =>
      item.uri === task.uri
        ? { ...item, data: { ...item.data!, completed: "2026-10-26T10:00:00" } }
        : item,
    );
    spy.listeners.forEach((listener) => listener());
  },
}));
vi.mock("@/stores/tasks/mutations/use-reorder-section", () => ({
  useReorderSection: () => async () => undefined,
}));
vi.mock("@/stores/tasks/use-vault-read", () => ({
  useGrantFolder: () => async () => undefined,
  useRefreshTasks: () => async () => undefined,
}));
vi.mock("@/stores/tasks/use-vault-failures", () => ({
  useVaultFailures: () => [],
}));

vi.mock("@/components/task-row", async () => {
  const React = await import("react");
  const Row = React.memo(function Row({
    task,
    onToggle,
    onOpen,
    onTickSettled,
    grip,
  }: {
    task: TaskItem;
    onToggle?: (task: TaskItem) => void;
    onOpen?: (task: TaskItem) => void;
    onTickSettled?: (task: TaskItem) => void;
    grip?: React.ReactNode;
  }) {
    spy.renders[task.name] = (spy.renders[task.name] ?? 0) + 1;
    React.useEffect(() => {
      spy.mounts[task.name] = (spy.mounts[task.name] ?? 0) + 1;
    }, [task.name]);
    // The real row ends its hold from the tick's animation. The
    // stand-in does the same after the wash's 320 ms.
    const done = task.data?.completed != null;
    React.useEffect(() => {
      if (!done) {
        return;
      }
      const timer = setTimeout(() => onTickSettled?.(task), 320);
      return () => clearTimeout(timer);
    }, [done, task, onTickSettled]);
    return (
      <div data-testid={`row:${task.name}`}>
        <button aria-label={`tick ${task.name}`} onClick={() => onToggle?.(task)} />
        <button aria-label={`open ${task.name}`} onClick={() => onOpen?.(task)} />
        {grip}
      </div>
    );
  });
  return { TaskRow: Row };
});

const dock = () => null;

function task(name: string, due?: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: { kind: "[[tasks]]", created: "2026-10-20", ...(due ? { due } : {}) },
    body: "",
  };
}

const tick = (name: string) => fireEvent.click(screen.getByLabelText(`tick ${name}`));
const holdBeat = () => act(() => void vi.advanceTimersByTime(400));

/** A task on the Errands tab, so a preview of it has rows. */
function listedTask(name: string): TaskItem {
  const uri = `content://vault/Tasks/${name}.md`;
  return {
    id: uri,
    uri,
    fileName: `${name}.md`,
    name,
    text: "",
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      list: "[[Errands]]",
    },
    body: "",
  };
}

function pointer(type: string, x: number, y = 300) {
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

// React Native Web reports onLayout through a ResizeObserver, and
// jsdom lays out nothing. This one reads the box the test placed.
beforeAll(() => {
  window.ResizeObserver = class {
    constructor(private report: ResizeObserverCallback) {}
    observe(target: Element) {
      setTimeout(() =>
        this.report([{ target } as ResizeObserverEntry], this as unknown as ResizeObserver),
      );
    }
    unobserve() {}
    disconnect() {}
  };
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  spy.renders = {};
  spy.mounts = {};
  spy.screenRenders = 0;
  spy.push.mockClear();
  spy.sortMode = "due";
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ListsScreen", () => {
  it("re-renders only the ticked row on a tick", () => {
    // Bug 4: each row got new callbacks on every render, so one tick
    // rendered every row twice, once at the hold and once after it.
    spy.tasks = [task("Apple"), task("Banana"), task("Cherry")];
    render(<ListsScreen dock={dock} />);
    const before = { ...spy.renders };

    tick("Banana");
    holdBeat();

    expect(spy.renders.Apple).toBe(before.Apple);
    expect(spy.renders.Cherry).toBe(before.Cherry);
  });

  it("mounts no row of a later group when a group above leaves", () => {
    // Bug 5: a section with no key made SectionList key each row by the
    // section's index, so every row below a vanished group remounted.
    spy.tasks = [task("Pay rent", todayIso()), task("Apple"), task("Banana")];
    render(<ListsScreen dock={dock} />);
    expect(spy.mounts.Apple).toBe(1);

    tick("Pay rent");
    holdBeat();

    expect(spy.mounts.Apple).toBe(1);
    expect(spy.mounts.Banana).toBe(1);
  });

  it("still opens the editor from a row", () => {
    spy.tasks = [task("Apple")];
    render(<ListsScreen dock={dock} />);

    fireEvent.click(screen.getByLabelText("open Apple"));

    expect(spy.push).toHaveBeenCalledWith(
      `/task/${encodeURIComponent("content://vault/Tasks/Apple.md")}`,
    );
  });

  it("holds a ticked row in its place for one beat", () => {
    spy.tasks = [task("Apple", todayIso()), task("Banana")];
    render(<ListsScreen dock={dock} />);

    tick("Apple");

    // The store already says done, and the row is still above Banana.
    const order = () =>
      screen.getAllByTestId(/^row:/).map((node) => node.dataset.testid);
    expect(order()).toEqual(["row:Apple", "row:Banana"]);
    holdBeat();
    expect(order()).toEqual(["row:Banana", "row:Apple"]);
  });

  it("renders no row and no screen while a grip crosses three slots", async () => {
    // J2: the ghost, the shifts and the corners are shared values, so
    // the screen and every task row stay still for the whole drag.
    vi.useRealTimers();
    spy.sortMode = "manual";
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
    spy.tasks = names.map((name) => task(name));
    render(<ListsScreen dock={dock} />);
    names.forEach((name, index) => {
      placeBox(screen.getByTestId(`reorder-item:${name}`), {
        x: 0,
        y: index * 48,
        width: 390,
        height: 48,
      });
      placeBox(screen.getByTestId(`reorder-grip:${name}`), {
        x: 360,
        y: index * 48 + 12,
        width: 44,
        height: 44,
      });
    });
    const grip = screen.getByTestId("reorder-grip:Delta");

    await act(async () => {
      grip.dispatchEvent(pointer("pointerdown", 370, 156));
    });
    await wait(50);
    expect(screen.getByTestId("drag-ghost"), "the grip picked the row up").toBeTruthy();
    const pickedScreen = spy.screenRenders;
    const pickedRows = { ...spy.renders };

    for (let step = 1; step <= 6; step += 1) {
      await act(async () => {
        grip.dispatchEvent(pointer("pointermove", 370, 156 - step * 25));
      });
      await wait(16);
    }
    await act(async () => {
      grip.dispatchEvent(pointer("pointerup", 370, 6));
    });
    await wait(50);

    expect(spy.screenRenders, "a crossing renders the screen").toBe(pickedScreen);
    expect(spy.renders, "a crossing renders a task row").toEqual(pickedRows);
  });

  it("renders nothing at a swipe start, and caps the preview rows", async () => {
    // J1: the old pager set screen state at swipe start and the list
    // preview rendered all 300 rows. The surface owns the visible set,
    // and the preview draws one screenful.
    vi.useRealTimers();
    setWindowSize(390, 600);
    spy.tasks = Array.from({ length: 300 }, (_, index) =>
      listedTask(`Task ${index}`),
    );
    render(<ListsScreen dock={dock} />);
    const host = screen.getByTestId("list-pager");
    placeBox(host, { x: 0, y: 0, width: 390, height: 600 });
    await act(async () => {
      window.dispatchEvent(new Event("resize"));
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    const before = spy.screenRenders;

    await act(async () => {
      host.dispatchEvent(pointer("pointerdown", 300));
    });
    const steps = 6;
    for (let i = 1; i <= steps; i++) {
      await act(async () => {
        host.dispatchEvent(pointer("pointermove", 300 - (60 * i) / steps));
        await new Promise((resolve) => setTimeout(resolve, 16));
      });
    }

    expect(spy.screenRenders, "a swipe start renders the screen").toBe(before);
    const previewRows = screen.queryAllByText(/^Task \d+$/);
    expect(previewRows.length).toBeGreaterThan(0);
    expect(previewRows.length).toBeLessThanOrEqual(Math.floor(600 / 48));

    await act(async () => {
      host.dispatchEvent(pointer("pointerup", 240));
      await new Promise((resolve) => setTimeout(resolve, 400));
    });
  });
});

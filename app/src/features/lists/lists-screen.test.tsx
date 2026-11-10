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
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("expo-router", () => ({ router: { push: spy.push } }));

vi.mock("@/lib/settings", () => ({
  loadSettings: () => ({ taskForm: "rows", sortMode: "due" }),
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
  }: {
    task: TaskItem;
    onToggle?: (task: TaskItem) => void;
    onOpen?: (task: TaskItem) => void;
  }) {
    spy.renders[task.name] = (spy.renders[task.name] ?? 0) + 1;
    React.useEffect(() => {
      spy.mounts[task.name] = (spy.mounts[task.name] ?? 0) + 1;
    }, [task.name]);
    return (
      <div data-testid={`row:${task.name}`}>
        <button aria-label={`tick ${task.name}`} onClick={() => onToggle?.(task)} />
        <button aria-label={`open ${task.name}`} onClick={() => onOpen?.(task)} />
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
      lists: ["[[Errands]]"],
    },
    body: "",
  };
}

function pointer(type: string, x: number) {
  return new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    pointerId: 1,
    pointerType: "touch",
    isPrimary: true,
    clientX: x,
    clientY: 300,
    button: 0,
    buttons: type === "pointerup" ? 0 : 1,
  });
}

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

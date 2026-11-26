import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { setCompletedOpen } from "@/lib/folded-completed";
import { selectList } from "@/lib/selected-list";
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
  open: vi.fn(),
  tasks: [] as unknown[],
  completed: [] as string[],
  listeners: new Set<() => void>(),
  sortMode: "due" as "due" | "manual",
  /** Whether the rows on screen are last session's. */
  stale: false,
  /** Each reorder write, as the names and orders it would send. */
  writes: [] as [string, number][][],
  /** How long the stand-in row's tick holds before it lets go. */
  tickSettleMs: 320,
}));

vi.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

vi.mock("@/hooks/use-task-editor", () => ({
  useTaskEditor: () => ({ open: spy.open, showing: false }),
}));

vi.mock("@/lib/settings", () => ({
  // Today is off here, so this screen's tabs stay Main first and the
  // drag tests read the order they always read.
  loadSettings: () => ({
    taskForm: "rows",
    sortMode: spy.sortMode,
    todayList: "off",
  }),
  saveSetting: () => undefined,
}));

vi.mock("@/components/bottom-bar/bottom-bar", () => ({ BottomBar: () => null }));

// The toolbar renders only when the screen renders, so its count is
// the screen's count. The pager's own state sits below it. The stub
// records the completed rows the toolbar would act on.
vi.mock("./components/lists-toolbar", () => {
  const Toolbar = ({ completed }: { completed?: TaskItem[] }) => {
    spy.screenRenders += 1;
    spy.completed = (completed ?? []).map((task) => task.name);
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
  return {
    useTaskList: () =>
      React.useSyncExternalStore(subscribe, () => spy.tasks) as TaskItem[],
    useStoreMeta: () => ({
      rootUri: "root",
      status: "ready",
      readError: null,
      brokenLists: [],
      lists: ["Errands"],
      stale: spy.stale,
    }),
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
  useReorderSection: () => async (changes: { task: TaskItem; order: number }[]) => {
    spy.writes.push(changes.map(({ task: item, order }) => [item.name, order]));
  },
}));
vi.mock("@/stores/tasks/mutations/use-clear-completed", () => ({
  useClearCompleted: () => async () => undefined,
}));
vi.mock("@/stores/tasks/use-vault-read", () => ({
  useGrantFolder: () => async () => undefined,
  useRefreshTasks: () => async () => undefined,
}));
const cacheWrite = vi.hoisted(() => ({ rows: [] as unknown[] }));
vi.mock("@/stores/tasks/row-cache", () => ({
  writeCachedRows: (rows: unknown) => cacheWrite.rows.push(rows),
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
      const timer = setTimeout(() => onTickSettled?.(task), spy.tickSettleMs);
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
    data: {
      kind: "[[tasks]]",
      created: "2026-10-20",
      "alert weight": "harsh",
      ...(due ? { due } : {}),
    },
    body: "",
  };
}

/** A done task. A `list` files it on that tab. */
function completed(name: string, list?: string): TaskItem {
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
      completed: "2026-10-26",
      "alert weight": "harsh",
      ...(list == null ? {} : { list: `[[${list}]]` }),
    },
    body: "",
  };
}

const tick = (name: string) => fireEvent.click(screen.getByLabelText(`tick ${name}`));
const holdBeat = () => act(() => void vi.advanceTimersByTime(400));

function doneTask(name: string): TaskItem {
  const item = task(name);
  return {
    ...item,
    data: { ...item.data!, completed: "2026-10-26T10:00:00" },
  };
}

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
      "alert weight": "harsh",
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
  spy.open.mockClear();
  spy.sortMode = "due";
  spy.completed = [];
  spy.writes = [];
  spy.tickSettleMs = 320;
  spy.stale = false;
  cacheWrite.rows = [];
  selectList("Main");
  setCompletedOpen("Main", false);
  setCompletedOpen("Errands", false);
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

  it("keeps a warned task's row and names the warning", () => {
    const warned: TaskItem = {
      ...task("Descale the kettle"),
      warnings: [
        'alert weight "loud" is not harsh or quiet, so it rings harsh',
      ],
    };
    spy.tasks = [warned, task("Banana")];
    render(<ListsScreen dock={dock} />);

    expect(screen.getByTestId("row:Descale the kettle")).toBeTruthy();
    expect(
      screen.getByText(
        '• alert weight "loud" is not harsh or quiet, so it rings harsh',
      ),
    ).toBeTruthy();
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

  it("keeps the launch tab's rows for the next cold start", () => {
    spy.tasks = [task("Apple", todayIso()), task("Banana", todayIso())];
    render(<ListsScreen dock={dock} />);

    expect(cacheWrite.rows).toHaveLength(1);
    const rows = cacheWrite.rows[0] as { tab: string; tasks: TaskItem[] };
    // Today is off in this file's settings, so Main leads.
    expect(rows.tab).toBe("Main");
    expect(rows.tasks.map((item) => item.name)).toEqual(["Apple", "Banana"]);
  });

  it("keeps no rows while the cached frame stands in", () => {
    spy.stale = true;
    spy.tasks = [task("Apple", todayIso())];
    render(<ListsScreen dock={dock} />);

    expect(cacheWrite.rows).toEqual([]);
  });

  it("takes no tick and no press on a row of the cached frame", () => {
    // Last session's rows may be wrong until the read lands, so they
    // draw dimmed and inert (ADR 20261126-a-cached-first-frame).
    spy.stale = true;
    spy.tasks = [task("Apple", todayIso())];
    render(<ListsScreen dock={dock} />);

    fireEvent.click(screen.getByLabelText("tick Apple"));
    fireEvent.click(screen.getByLabelText("open Apple"));

    expect(spy.writes).toEqual([]);
    expect(spy.open).not.toHaveBeenCalled();
    expect(screen.getByText("Syncing your vault")).toBeTruthy();
  });

  it("opens the editor sheet from a row", () => {
    spy.tasks = [task("Apple")];
    render(<ListsScreen dock={dock} />);

    fireEvent.click(screen.getByLabelText("open Apple"));

    expect(spy.open).toHaveBeenCalledWith("content://vault/Tasks/Apple.md");
  });

  it("draws My order as one headerless group above Completed", () => {
    spy.sortMode = "manual";
    spy.tasks = [
      task("Banana", todayIso()),
      task("Apple"),
      doneTask("Cherry"),
    ];
    render(<ListsScreen dock={dock} />);

    // Completed starts folded, so its one row stays out of the page and
    // the header carries the count.
    expect(
      screen.getAllByTestId(/^row:/).map((node) => node.dataset.testid),
    ).toEqual(["row:Apple", "row:Banana"]);
    expect(screen.queryByText(/^Today\s+\d+$/)).toBeNull();
    expect(screen.queryByText(/^No date\s+\d+$/)).toBeNull();
    expect(screen.getByRole("button", { name: "Completed 1 task" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Completed 1 task" }));

    expect(
      screen.getAllByTestId(/^row:/).map((node) => node.dataset.testid),
    ).toEqual(["row:Apple", "row:Banana", "row:Cherry"]);
  });

  it("holds a ticked row in its place for one beat", () => {
    spy.tasks = [task("Apple", todayIso()), task("Banana"), completed("Archived")];
    render(<ListsScreen dock={dock} />);
    fireEvent.click(screen.getByRole("button", { name: "Completed 1 task" }));

    tick("Apple");

    // The store already says done, and the row is still above Banana.
    const order = () =>
      screen.getAllByTestId(/^row:/).map((node) => node.dataset.testid);
    expect(order()).toEqual(["row:Apple", "row:Banana", "row:Archived"]);
    holdBeat();
    expect(order()).toEqual(["row:Banana", "row:Apple", "row:Archived"]);
  });

  it("starts with Completed folded and opens and closes on its header", () => {
    spy.tasks = [task("Apple", todayIso()), completed("Archived")];
    render(<ListsScreen dock={dock} />);

    const header = () =>
      screen.getByRole("button", { name: "Completed 1 task" });
    expect(header().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("row:Archived")).toBeNull();

    fireEvent.click(header());
    expect(header().getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByTestId("row:Archived")).toBeTruthy();

    fireEvent.click(header());
    expect(header().getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByTestId("row:Archived")).toBeNull();
  });

  it("folds a ticked row away after its wash", () => {
    // The row holds while the circle plays, then joins the folded
    // group, so a done task leaves the page without a second tap.
    spy.tasks = [task("Apple", todayIso()), task("Banana")];
    render(<ListsScreen dock={dock} />);

    tick("Apple");
    expect(screen.getByTestId("row:Apple")).toBeTruthy();
    holdBeat();

    expect(screen.queryByTestId("row:Apple")).toBeNull();
    expect(
      screen
        .getByRole("button", { name: "Completed 1 task" })
        .getAttribute("aria-expanded"),
    ).toBe("false");
  });

  it("hands the clear only the current tab's completed rows", () => {
    spy.tasks = [completed("Main done"), completed("Errands done", "Errands")];
    render(<ListsScreen dock={dock} />);
    expect(spy.completed).toEqual(["Main done"]);

    act(() => selectList("Errands"));
    expect(spy.completed).toEqual(["Errands done"]);
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

  /** Places `names` as one group of 48 px rows. */
  function placeRows(names: string[]) {
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
  }

  /** Picks row `from` up by its grip and holds it over the first slot. */
  async function holdOverTop(grip: HTMLElement, from: number) {
    const start = from * 48 + 12;
    await act(async () => {
      grip.dispatchEvent(pointer("pointerdown", 370, start));
    });
    await wait(50);
    // The grip keeps no pointer capture, so the move out of its box
    // comes first and the move to the top carries the new point.
    for (const y of [start - 60, 60, 6]) {
      await act(async () => {
        grip.dispatchEvent(pointer("pointermove", 370, y));
      });
      await wait(16);
    }
  }

  async function release(grip: HTMLElement) {
    await act(async () => {
      grip.dispatchEvent(pointer("pointerup", 370, 6));
    });
    await wait(50);
  }

  /** The store takes write `at`: the rows carry their new numbers, so
      the next render reads the group in the order it wrote. */
  function landed(at: number) {
    const orders = new Map(spy.writes[at]);
    spy.tasks = (spy.tasks as TaskItem[]).map((item) => {
      const order = orders.get(item.name);
      return order == null ? item : { ...item, data: { ...item.data!, order } };
    });
    act(() => spy.listeners.forEach((listener) => listener()));
  }

  /** Renders `names` as one My order group, and returns the grip of
      `gripOf`. */
  function manualBoard(names: string[], gripOf: string): HTMLElement {
    vi.useRealTimers();
    spy.sortMode = "manual";
    spy.tasks = names.map((name) => task(name));
    render(<ListsScreen dock={dock} />);
    placeRows(names);
    return screen.getByTestId(`reorder-grip:${gripOf}`);
  }

  /** A tick from a second finger: its own press, then its click, so
      the drag's one-click guard lets the press through. */
  function tapTick(name: string) {
    const button = screen.getByLabelText(`tick ${name}`);
    fireEvent.pointerDown(button);
    fireEvent.click(button);
  }

  it("drops a held row into the order a tick left behind", async () => {
    // Ticket 20261111-reorder-during-a-tick-hold: the tick's hold ends
    // between pick-up and drop, so the group loses the ticked row while
    // the drop still counts it. The picked row's data index then names
    // the row below it, and that row takes the drop.
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
    const grip = manualBoard(names, "Delta");

    await holdOverTop(grip, 3);
    expect(screen.getByTestId("drag-ghost"), "the grip picked the row up").toBeTruthy();

    // The tick's hold ends here, before the drop, so the group loses
    // Bravo while the drag still counts it.
    spy.tickSettleMs = 10;
    tapTick("Bravo");
    await wait(100);
    expect(
      screen.queryByTestId("row:Bravo"),
      "the ticked row left the group",
    ).toBeNull();

    await release(grip);

    expect(spy.writes).toEqual([
      [
        ["Delta", 1],
        ["Alpha", 2],
        ["Charlie", 3],
        ["Echo", 4],
      ],
    ]);
  });

  it("drops a held row into the group its tick has not left yet", async () => {
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
    const grip = manualBoard(names, "Delta");

    await holdOverTop(grip, 3);

    // The tick is in its hold, so the row still sits in the group. The
    // hold outlasts the drop, so a slow runner cannot end it first.
    spy.tickSettleMs = 3000;
    tapTick("Bravo");
    await release(grip);

    expect(spy.writes).toEqual([
      [
        ["Delta", 1],
        ["Alpha", 2],
        ["Bravo", 3],
        ["Charlie", 4],
        ["Echo", 5],
      ],
    ]);
  });

  it("cancels a drop whose group a step reordered under it", async () => {
    const names = ["Alpha", "Bravo", "Charlie", "Delta", "Echo"];
    const grip = manualBoard(names, "Delta");

    await holdOverTop(grip, 3);

    // A grip step on another row runs while Delta is held. The step
    // writes its own order, and the drop either way must not read the
    // pickup indexes as the group's order now.
    screen.getByTestId("reorder-grip:Charlie").focus();
    await act(async () => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
    });
    await wait(50);
    const stepped = spy.writes.length;
    landed(0);

    await release(grip);

    expect(stepped, "the step wrote its own order").toBe(1);
    expect(spy.writes, "the drop wrote nothing").toHaveLength(1);
    expect(screen.queryByTestId("drag-ghost"), "the drag canceled").toBeNull();
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

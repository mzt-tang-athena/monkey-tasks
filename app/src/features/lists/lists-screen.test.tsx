import * as React from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { TaskItem } from "@/types/task";
import { todayIso } from "@/utils/dates";
import ListsScreen from "./lists-screen";

// The screen's inputs are the store, the router and the settings. The
// task row is a counting stand-in: a row that renders again, or mounts
// again, shows in the counts. The real row is memoized, so the stand-in
// is too.

const spy = vi.hoisted(() => ({
  renders: {} as Record<string, number>,
  mounts: {} as Record<string, number>,
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
    lists: [],
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

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
  spy.renders = {};
  spy.mounts = {};
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
});

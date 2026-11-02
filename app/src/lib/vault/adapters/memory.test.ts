import { afterEach, describe, expect, it, vi } from "vitest";
import { MEMORY_ROOT, createMemoryVault } from "./memory";

// What the memory adapter does beyond the shared contract: the names a
// race gets, and the latency and failures a test injects.

const TASKS = `${MEMORY_ROOT}/Tasks`;
const CALL = `${TASKS}/Call.md`;

afterEach(() => {
  vi.useRealTimers();
});

describe("createMemoryVault", () => {
  it("gives two creates of one name in the same tick two names", async () => {
    const vault = createMemoryVault({}, { latencyMs: 20 });
    const tasks = await vault.makeFolder(MEMORY_ROOT, "Tasks");

    const [first, second] = await Promise.all([
      vault.create(tasks, "Milk.md", "one"),
      vault.create(tasks, "Milk.md", "two"),
    ]);

    expect([first.fileName, second.fileName]).toEqual([
      "Milk.md",
      "Milk (1).md",
    ]);
    expect(vault.hooks.files()).toEqual({
      "Tasks/Milk (1).md": "two",
      "Tasks/Milk.md": "one",
    });
  });

  it("holds a create's name, empty, until its text lands", async () => {
    vi.useFakeTimers();
    const vault = createMemoryVault({ "Tasks/Call.md": "call" }, { latencyMs: 100 });

    const creating = vault.create(TASKS, "Milk.md", "milk");

    expect(vault.hooks.read("Tasks/Milk.md")).toBe("");
    await vi.advanceTimersByTimeAsync(100);
    await creating;
    expect(vault.hooks.read("Tasks/Milk.md")).toBe("milk");
  });

  it("seeds the folders its files sit in", async () => {
    const vault = createMemoryVault({ "Tasks/Lists/Focus.md": "focus" });

    expect(await vault.findFolder(MEMORY_ROOT, "Tasks")).toBe(TASKS);
    expect(await vault.findFolder(TASKS, "Lists")).toBe(`${TASKS}/Lists`);
  });

  it("does not take a file with no extension for a folder", async () => {
    const vault = createMemoryVault({ Tasks: "a file" });

    expect(await vault.findFolder(MEMORY_ROOT, "Tasks")).toBeNull();
  });

  it("delays every call by its latency", async () => {
    vi.useFakeTimers();
    const vault = createMemoryVault({ "Tasks/Call.md": "call" }, { latencyMs: 100 });
    let text: string | null = null;

    void vault.read(CALL).then((read) => {
      text = read;
    });
    await vi.advanceTimersByTimeAsync(99);
    expect(text).toBeNull();
    await vi.advanceTimersByTimeAsync(1);
    expect(text).toBe("call");
  });

  it("fails the calls its fail option picks", async () => {
    const vault = createMemoryVault(
      { "Tasks/Call.md": "call", "Tasks/Bread.md": "bread" },
      {
        fail: (op, uri) =>
          op === "write" && uri === CALL ? new Error("disk full") : null,
      },
    );

    await expect(vault.write(CALL, "new")).rejects.toThrow("disk full");
    await vault.write(`${TASKS}/Bread.md`, "new");

    expect(vault.hooks.files()).toEqual({
      "Tasks/Bread.md": "new",
      "Tasks/Call.md": "call",
    });
  });

  it("removes a folder with the files in it", async () => {
    const vault = createMemoryVault({ "Tasks/Lists/Focus.md": "focus" });

    await vault.remove(`${TASKS}/Lists`);

    expect(vault.hooks.files()).toEqual({});
    expect(await vault.findFolder(TASKS, "Lists")).toBeNull();
  });
});

describe("the memory vault's test hooks", () => {
  it("reads and writes files by path, as another app would", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    vault.hooks.write("Tasks/Lists/Focus.md", "focus");
    vault.hooks.write("Tasks/Call.md", "edited");

    expect(vault.hooks.read("Tasks/Call.md")).toBe("edited");
    expect(vault.hooks.read("Tasks/Gone.md")).toBeNull();
    expect(await vault.read(CALL)).toBe("edited");
    expect(await vault.findFolder(TASKS, "Lists")).toBe(`${TASKS}/Lists`);
  });

  it("resets to a seed", () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    vault.hooks.reset({ "Tasks/Milk.md": "milk" });

    expect(vault.hooks.files()).toEqual({ "Tasks/Milk.md": "milk" });
  });

  it("fails the next call of one kind on one file, once", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    vault.hooks.failNext("write", "Call.md");

    await expect(vault.write(CALL, "new")).rejects.toThrow("write failed: Call.md");
    await vault.write(CALL, "new");
    expect(vault.hooks.read("Tasks/Call.md")).toBe("new");
  });

  it("fails a create by the name it asks for", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    vault.hooks.failNext("create", "Milk.md");

    await expect(vault.create(TASKS, "Milk.md", "milk")).rejects.toThrow();
    expect(vault.hooks.read("Tasks/Milk.md")).toBeNull();
  });

  it("sets the latency for the calls after it", async () => {
    vi.useFakeTimers();
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });
    vault.hooks.setLatency(50);
    let done = false;

    void vault.write(CALL, "new").then(() => {
      done = true;
    });
    await vi.advanceTimersByTimeAsync(49);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(done).toBe(true);
  });
});

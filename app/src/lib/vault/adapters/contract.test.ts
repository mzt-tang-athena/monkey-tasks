import { beforeEach, describe, expect, it, vi } from "vitest";

// The SAF adapter runs its own code against a fake document provider.
// The memory adapter must behave the same wherever the app can tell,
// so one set of cases runs against both (ADR 0037).
vi.mock("expo-file-system/legacy", async () => {
  const { sharedFakeSaf } = await import("@/testing/fake-saf");
  return sharedFakeSaf.module;
});

import { sharedFakeSaf as saf } from "@/testing/fake-saf";
import type { VaultAdapter } from "../adapter";
import { createMemoryVault } from "./memory";
import { safAdapter } from "./saf";

type Opened = { adapter: VaultAdapter; root: string };

const subjects: { name: string; open(): Promise<Opened> }[] = [
  {
    name: "memory",
    async open() {
      const adapter = createMemoryVault();
      return { adapter, root: await granted(adapter) };
    },
  },
  {
    name: "SAF",
    async open() {
      saf.reset();
      return { adapter: safAdapter, root: await granted(safAdapter) };
    },
  },
];

async function granted(adapter: VaultAdapter): Promise<string> {
  const root = await adapter.requestRoot();
  if (root == null) {
    throw new Error("the adapter granted no root");
  }
  return root;
}

describe.each(subjects)("the $name adapter", (subject) => {
  let adapter: VaultAdapter;
  let root: string;

  beforeEach(async () => {
    ({ adapter, root } = await subject.open());
  });

  it("keeps the root it was granted", async () => {
    expect(await adapter.savedRoot()).toBe(root);
  });

  it("lists a folder by name, and tells a folder from a file", async () => {
    const tasks = await adapter.makeFolder(root, "Tasks");
    await adapter.create(tasks, "Water.md", "water");
    await adapter.create(tasks, "Call.md", "call");
    await adapter.makeFolder(tasks, "Lists");

    const entries = await adapter.list(tasks);

    expect(entries.map(({ name, isFolder }) => ({ name, isFolder }))).toEqual([
      { name: "Call.md", isFolder: false },
      { name: "Lists", isFolder: true },
      { name: "Water.md", isFolder: false },
    ]);
  });

  it("reads back what it wrote", async () => {
    const { uri } = await adapter.create(root, "Call.md", "first");
    expect(await adapter.read(uri)).toBe("first");

    await adapter.write(uri, "second");

    expect(await adapter.read(uri)).toBe("second");
  });

  it("refuses to read or write a file that is gone", async () => {
    const { uri } = await adapter.create(root, "Call.md", "text");
    await adapter.remove(uri);

    await expect(adapter.read(uri)).rejects.toThrow();
    await expect(adapter.write(uri, "again")).rejects.toThrow();
  });

  it("gives a taken name the next free number", async () => {
    const first = await adapter.create(root, "Call.md", "one");
    const second = await adapter.create(root, "Call.md", "two");
    const third = await adapter.create(root, "Call.md", "three");

    expect([first, second, third].map((made) => made.fileName)).toEqual([
      "Call.md",
      "Call (1).md",
      "Call (2).md",
    ]);
    expect(await adapter.read(second.uri)).toBe("two");
    expect(await adapter.read(first.uri)).toBe("one");
  });

  it("removes a file, and takes a missing file as no error", async () => {
    const { uri } = await adapter.create(root, "Call.md", "text");

    await adapter.remove(uri);
    await adapter.remove(uri);

    expect(await adapter.list(root)).toEqual([]);
  });

  it("finds a folder, and makes one when asked", async () => {
    expect(await adapter.findFolder(root, "Tasks")).toBeNull();

    const made = await adapter.makeFolder(root, "Tasks");

    expect(await adapter.findFolder(root, "Tasks")).toBe(made);
    expect(await adapter.list(made)).toEqual([]);
  });

  it("finds a folder whose name has a dot", async () => {
    const made = await adapter.makeFolder(root, "Tasks 2.0");

    expect(await adapter.findFolder(root, "Tasks 2.0")).toBe(made);
  });

  it("does not take a file with a dot for a folder", async () => {
    await adapter.create(root, "Tasks.md", "a note");

    expect(await adapter.findFolder(root, "Tasks.md")).toBeNull();
  });

  it("names the folder that holds a file", async () => {
    const tasks = await adapter.makeFolder(root, "Tasks");
    const { uri } = await adapter.create(tasks, "Call Mum.md", "text");

    expect(adapter.parentOf(uri)).toBe(tasks);
  });
});

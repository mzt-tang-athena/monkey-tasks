import { beforeEach, describe, expect, it, vi } from "vitest";

// The vault read on both adapters: the SAF adapter over a fake document
// provider, and the memory adapter.
vi.mock("expo-file-system/legacy", async () => {
  const { sharedFakeSaf } = await import("@/testing/fake-saf");
  return sharedFakeSaf.module;
});

import { sharedFakeSaf as saf } from "@/testing/fake-saf";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { createMemoryVault } from "@/lib/vault/adapters/memory";
import { safAdapter } from "@/lib/vault/adapters/saf";
import { ensureTasksFolder, loadVault } from "./load-vault";

type Vault = { adapter: VaultAdapter; root: string };

const subjects: {
  name: string;
  open(files: Record<string, string>): Promise<Vault>;
}[] = [
  {
    name: "memory",
    async open(files) {
      const adapter = createMemoryVault(files);
      return { adapter, root: (await adapter.savedRoot()) as string };
    },
  },
  {
    name: "SAF",
    async open(files) {
      saf.reset();
      for (const [path, text] of Object.entries(files)) {
        saf.put(path, text);
      }
      return {
        adapter: safAdapter,
        root: (await safAdapter.requestRoot()) as string,
      };
    },
  },
];

const task = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n';
const list = '---\nkind: "[[lists]]"\ncreated: 2026-10-20\n---\n';

beforeEach(() => {
  saf.reset();
});

describe.each(subjects)("loadVault on the $name adapter", (subject) => {
  // Ticket 0051: the read made the folder when its listing missed it,
  // so a slow listing left a second Tasks folder and an empty list.
  it("creates nothing when the root has no Tasks folder", async () => {
    const vault = await subject.open({ "Inbox/Note.md": "a note" });

    const read = await loadVault(vault.adapter, vault.root);

    expect(read).toEqual({ tasksDir: null, tasks: [], lists: [], broken: [] });
    expect(await vault.adapter.findFolder(vault.root, "Tasks")).toBeNull();
    expect((await vault.adapter.list(vault.root)).map((entry) => entry.name)).toEqual([
      "Inbox",
    ]);
  });

  it("reads the task notes and the list notes in the Tasks folder", async () => {
    const vault = await subject.open({
      "Tasks/Call.md": task,
      "Tasks/Lists/Focus.md": list,
      "Tasks/Lists/Garden.md": '---\nkind: "[[list]]"\n---\n',
    });

    const read = await loadVault(vault.adapter, vault.root);

    expect(read.tasksDir).toBe(await vault.adapter.findFolder(vault.root, "Tasks"));
    expect(read.tasks.map((row) => row.name)).toEqual(["Call"]);
    expect(read.lists.map((item) => item.name)).toEqual(["Focus"]);
    expect(read.broken.map((item) => item.name)).toEqual(["Garden"]);
  });

  it("makes the Tasks folder once for a write, and finds it after", async () => {
    const vault = await subject.open({});

    const made = await ensureTasksFolder(vault.adapter, vault.root);
    const found = await ensureTasksFolder(vault.adapter, vault.root);

    expect(found).toBe(made);
    expect((await vault.adapter.list(vault.root)).map((entry) => entry.name)).toEqual([
      "Tasks",
    ]);
  });
});

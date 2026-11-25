import { beforeEach, describe, expect, it, vi } from "vitest";

// The vault read on both adapters: the SAF adapter over a fake document
// provider, and the memory adapter.
vi.mock("expo-file-system/legacy", async () => {
  const { sharedFakeSaf } = await import("@/testing/fake-saf");
  return sharedFakeSaf.module;
});
vi.mock("expo-file-system", async () => {
  const { sharedFakeSaf } = await import("@/testing/fake-saf");
  return sharedFakeSaf.fileModule;
});

import { sharedFakeSaf as saf } from "@/testing/fake-saf";
import type { VaultAdapter } from "@/lib/vault/adapter";
import { createMemoryVault } from "@/lib/vault/adapters/memory";
import { safAdapter } from "@/lib/vault/adapters/saf";
import { SAMPLE_DAY, sampleSeed } from "@/lib/vault/sample/seed";
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
const deed =
  '---\nkind: "[[deeds]]"\nstatus: "[[active]]"\nparent deed: "[[Garden]]"\n---\n';
const reference =
  '---\nkind: "[[deeds]]"\nparent deed: "[[Garden]]"\n---\n';

/** Every file under the root, with its exact text: what the read sees
    and must leave alone. */
async function snapshot(vault: Vault): Promise<Record<string, string>> {
  const files: Record<string, string> = {};
  async function walk(uri: string, prefix: string): Promise<void> {
    for (const entry of await vault.adapter.list(uri)) {
      const path = `${prefix}${entry.name}`;
      if (entry.isFolder) {
        await walk(entry.uri, `${path}/`);
      } else {
        files[path] = await vault.adapter.read(entry.uri);
      }
    }
  }
  await walk(vault.root, "");
  return files;
}

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

  it("reads deeds beside tasks and drops a deed with no status", async () => {
    const vault = await subject.open({
      "Tasks/Call.md": task,
      "Deeds/Water the beds.md": deed,
      "Deeds/Brainstorm.md": reference,
    });

    const read = await loadVault(vault.adapter, vault.root);

    expect(read.tasks.map((row) => row.name)).toEqual(["Call", "Water the beds"]);
    expect(read.tasks.map((row) => row.folder)).toEqual([undefined, "deeds"]);
    expect(read.tasks[1].data?.status).toBe("[[active]]");
    expect(await vault.adapter.findFolder(vault.root, "Deeds")).not.toBeNull();
  });

  it("reads without writing a byte, and makes no folder", async () => {
    const files = {
      "Tasks/Call.md": task,
      "Tasks/Lists/Focus.md": list,
      "Deeds/Water the beds.md": deed,
      "Deeds/Brainstorm.md": reference,
      "Journal/Daily/2026-10-20.md": "8:05\n- Woke up early\n",
    };
    const vault = await subject.open(files);
    const before = await snapshot(vault);

    await loadVault(vault.adapter, vault.root);

    expect(await snapshot(vault)).toEqual(before);
  });
});

describe("a vault with deeds only", () => {
  it("reads the deeds even with no Tasks folder, and makes none", async () => {
    const vault = createMemoryVault({ "Deeds/Water the beds.md": deed });
    const root = (await vault.savedRoot()) as string;

    const read = await loadVault(vault, root);

    expect(read.tasksDir).toBeNull();
    expect(read.tasks.map((row) => row.name)).toEqual(["Water the beds"]);
    expect(await vault.findFolder(root, "Tasks")).toBeNull();
  });
});

describe("the sample deed fixtures", () => {
  it("reads every deed and leaves each file byte-identical", async () => {
    const files = sampleSeed(["deeds"], SAMPLE_DAY);
    const vault = createMemoryVault(files);
    const root = (await vault.savedRoot()) as string;
    const before = vault.hooks.files();
    const deedPaths = Object.keys(files).filter((path) =>
      path.startsWith("Deeds/"),
    );

    const read = await loadVault(vault, root);

    expect(deedPaths).toHaveLength(2);
    expect(read.tasks.filter((row) => row.folder === "deeds")).toHaveLength(1);
    for (const path of deedPaths) {
      expect(vault.hooks.files()[path]).toBe(files[path]);
    }
    expect(vault.hooks.files()).toEqual(before);
  });
});

import { describe, expect, it, vi, beforeEach } from "vitest";

// The loader talks to SAF. The test pins what makes a note a list tab:
// the kind in its frontmatter, and its file name minus the extension.
vi.mock("../vault/scan", () => ({
  findSubfolder: vi.fn(),
  listDirectory: vi.fn(),
  displayName: vi.fn((uri: string) => {
    const segment = uri.split("/").pop() ?? uri;
    return decodeURIComponent(segment).split("/").pop() ?? segment;
  }),
}));

vi.mock("../vault/notes", () => ({
  readNote: vi.fn(),
}));

import { findSubfolder, listDirectory } from "../vault/scan";
import { readNote } from "../vault/notes";
import { loadLists, parseListNote } from "./query";

const listsDir = "content://root/vault/Tasks/Lists";

function entry(name: string, folder = false) {
  return {
    uri: `${listsDir}/${name}`,
    name,
    isFile: !folder,
  };
}

const listText = (name: string) =>
  `---\nkind: "[[lists]]"\ncreated: 2026-10-20\n---\n\n${name}\n`;

const taskText = '---\nkind: "[[tasks]]"\ncreated: 2026-10-20\n---\n\nBody.\n';

beforeEach(() => {
  vi.mocked(findSubfolder).mockReset();
  vi.mocked(listDirectory).mockReset();
  vi.mocked(readNote).mockReset();
});

describe("parseListNote", () => {
  it("names a list note after its file, minus the extension", () => {
    expect(parseListNote("Focus.md", listText("Focus"))).toBe("Focus");
    expect(parseListNote("2026 groceries.md", listText("groceries"))).toBe(
      "2026 groceries",
    );
  });

  it("rejects a task note carrying the tasks kind", () => {
    expect(parseListNote("Call.md", taskText)).toBeNull();
  });

  it("rejects text with no readable frontmatter", () => {
    expect(parseListNote("Broken.md", "no frontmatter here")).toBeNull();
    expect(parseListNote("Bad.md", '---\nkind: "[[lists]]"\n---\n')).toBeNull();
  });
});

describe("loadLists", () => {
  it("reads the Lists folder inside Tasks and returns its notes sorted", async () => {
    vi.mocked(findSubfolder).mockResolvedValue(listsDir);
    vi.mocked(listDirectory).mockResolvedValue([
      entry("Work.md"),
      entry("Focus.md"),
      entry("Tasks.md"),
      entry("Archive", true),
    ]);
    vi.mocked(readNote).mockImplementation(async (uri: string) => {
      if (uri.endsWith("/Work.md")) {
        return listText("Work");
      }
      if (uri.endsWith("/Focus.md")) {
        return listText("Focus");
      }
      return taskText;
    });

    const lists = await loadLists("content://root/vault/Tasks");

    expect(findSubfolder).toHaveBeenCalledWith(
      "content://root/vault/Tasks",
      "Lists",
    );
    expect(listDirectory).toHaveBeenCalledWith(listsDir);
    expect(lists).toEqual([
      { name: "Focus", uri: `${listsDir}/Focus.md` },
      { name: "Work", uri: `${listsDir}/Work.md` },
    ]);
  });

  it("skips a note that cannot be read without dropping the rest", async () => {
    vi.mocked(findSubfolder).mockResolvedValue(listsDir);
    vi.mocked(listDirectory).mockResolvedValue([
      entry("Focus.md"),
      entry("Locked.md"),
    ]);
    vi.mocked(readNote).mockImplementation(async (uri: string) => {
      if (uri.endsWith("/Locked.md")) {
        throw new Error("revoked grant");
      }
      return listText("Focus");
    });

    const lists = await loadLists("content://root/vault/Tasks");

    expect(lists).toEqual([{ name: "Focus", uri: `${listsDir}/Focus.md` }]);
  });

  it("returns no tabs when the Lists folder does not exist", async () => {
    vi.mocked(findSubfolder).mockResolvedValue(null);

    await expect(loadLists("content://root/vault/Tasks")).resolves.toEqual([]);
    expect(listDirectory).not.toHaveBeenCalled();
  });
});

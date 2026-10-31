/**
 * A fake Android document provider behind the `expo-file-system/legacy`
 * calls the SAF adapter makes. Tests mock the module with `module`, so
 * the adapter's own code runs against it.
 *
 * It behaves the way the external storage provider does on a phone:
 *
 * - A document uri carries its path, percent-encoded, after
 *   `/document/`. The tree uri is the granted root.
 * - Listing a file rejects. That is how the adapter tells a folder from
 *   a file whose name has no dot.
 * - A taken name gets " (1)", then " (2)", before the extension.
 * - A content uri always "exists" to `getInfoAsync`. Only the app's own
 *   files report a real answer.
 */

type Node = { kind: "file"; text: string } | { kind: "folder" };

const AUTHORITY = "content://com.android.externalstorage.documents";
const ROOT_ID = "primary:vault";

export const FAKE_TREE_URI = `${AUTHORITY}/tree/${encodeURIComponent(ROOT_ID)}`;
const DOCUMENT_DIRECTORY = "file:///data/user/0/monkey.tasks/files/";

export type FakeSaf = ReturnType<typeof createFakeSaf>;

export function createFakeSaf() {
  /** Documents by id: "primary:vault/Tasks/Call.md". */
  const nodes = new Map<string, Node>();
  /** The app's private files, by file:// uri. */
  const appFiles = new Map<string, string>();
  let grantOnRequest = true;
  let writeFailures = 0;

  function reset(): void {
    nodes.clear();
    nodes.set(ROOT_ID, { kind: "folder" });
    appFiles.clear();
    grantOnRequest = true;
    writeFailures = 0;
  }
  reset();

  function uriOf(id: string): string {
    return `${FAKE_TREE_URI}/document/${encodeURIComponent(id)}`;
  }

  function idOf(uri: string): string {
    if (uri === FAKE_TREE_URI) {
      return ROOT_ID;
    }
    const marker = "/document/";
    const at = uri.indexOf(marker);
    if (!uri.startsWith(FAKE_TREE_URI) || at === -1) {
      throw new Error(`not a document uri: ${uri}`);
    }
    return decodeURIComponent(uri.slice(at + marker.length));
  }

  function children(folderId: string): string[] {
    return [...nodes.keys()].filter(
      (id) =>
        id.startsWith(`${folderId}/`) &&
        !id.slice(folderId.length + 1).includes("/"),
    );
  }

  function folder(uri: string): string {
    const id = idOf(uri);
    if (nodes.get(id)?.kind !== "folder") {
      throw new Error(`not a directory: ${uri}`);
    }
    return id;
  }

  /** The provider's own rename for a taken name: "x (1).md". */
  function unique(folderId: string, name: string, isFolder: boolean): string {
    const dot = isFolder ? -1 : name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    for (let n = 1; nodes.has(`${folderId}/${candidate}`); n += 1) {
      candidate = `${base} (${n})${ext}`;
    }
    return `${folderId}/${candidate}`;
  }

  const StorageAccessFramework = {
    async readDirectoryAsync(uri: string): Promise<string[]> {
      return children(folder(uri)).map(uriOf);
    },
    async makeDirectoryAsync(parentUri: string, name: string): Promise<string> {
      const id = unique(folder(parentUri), name, true);
      nodes.set(id, { kind: "folder" });
      return uriOf(id);
    },
    async createFileAsync(
      parentUri: string,
      name: string,
      _mimeType: string,
    ): Promise<string> {
      const id = unique(folder(parentUri), name, false);
      nodes.set(id, { kind: "file", text: "" });
      return uriOf(id);
    },
    async requestDirectoryPermissionsAsync(): Promise<
      { granted: true; directoryUri: string } | { granted: false }
    > {
      return grantOnRequest
        ? { granted: true, directoryUri: FAKE_TREE_URI }
        : { granted: false };
    },
  };

  const module = {
    documentDirectory: DOCUMENT_DIRECTORY,
    EncodingType: { UTF8: "utf8" },
    StorageAccessFramework,
    async getInfoAsync(uri: string): Promise<{ exists: boolean }> {
      return { exists: uri.startsWith("file://") ? appFiles.has(uri) : true };
    },
    async readAsStringAsync(uri: string): Promise<string> {
      if (uri.startsWith("file://")) {
        const text = appFiles.get(uri);
        if (text == null) {
          throw new Error(`no such file: ${uri}`);
        }
        return text;
      }
      const node = nodes.get(idOf(uri));
      if (node?.kind !== "file") {
        throw new Error(`no such file: ${uri}`);
      }
      return node.text;
    },
    async writeAsStringAsync(uri: string, text: string): Promise<void> {
      if (uri.startsWith("file://")) {
        appFiles.set(uri, text);
        return;
      }
      const id = idOf(uri);
      if (nodes.get(id)?.kind !== "file") {
        throw new Error(`no such file: ${uri}`);
      }
      if (writeFailures > 0) {
        writeFailures -= 1;
        throw new Error("disk full");
      }
      nodes.set(id, { kind: "file", text });
    },
    async deleteAsync(
      uri: string,
      options: { idempotent?: boolean } = {},
    ): Promise<void> {
      if (uri.startsWith("file://")) {
        appFiles.delete(uri);
        return;
      }
      const id = idOf(uri);
      if (!nodes.has(id)) {
        if (options.idempotent) {
          return;
        }
        throw new Error(`no such document: ${uri}`);
      }
      for (const key of [...nodes.keys()]) {
        if (key === id || key.startsWith(`${id}/`)) {
          nodes.delete(key);
        }
      }
    },
  };

  return {
    /** The stand-in for `expo-file-system/legacy`. */
    module,
    treeUri: FAKE_TREE_URI,
    /** The document uri of a path under the root, "Tasks/Call.md". */
    uriOf: (path: string) => uriOf(`${ROOT_ID}/${path}`),
    /** Every document under the root, as "Tasks/" or "Tasks/Call.md". */
    paths(): string[] {
      return [...nodes.entries()]
        .filter(([id]) => id !== ROOT_ID)
        .map(([id, node]) =>
          `${id.slice(ROOT_ID.length + 1)}${node.kind === "folder" ? "/" : ""}`,
        )
        .sort();
    },
    /** Write a file under the root, with its folders, as another app would. */
    put(path: string, text: string): void {
      const parts = path.split("/");
      for (let depth = 1; depth < parts.length; depth += 1) {
        nodes.set(`${ROOT_ID}/${parts.slice(0, depth).join("/")}`, {
          kind: "folder",
        });
      }
      nodes.set(`${ROOT_ID}/${path}`, { kind: "file", text });
    },
    /** The text of a file under the root, or null. */
    text(path: string): string | null {
      const node = nodes.get(`${ROOT_ID}/${path}`);
      return node?.kind === "file" ? node.text : null;
    },
    /** Whether the folder picker grants the tree or the user cancels. */
    setGrant(granted: boolean): void {
      grantOnRequest = granted;
    },
    /** Fail the next write to a document, as a full disk does. */
    failNextWrite(): void {
      writeFailures += 1;
    },
    reset,
  };
}

/** One provider per test file. Its module backs the `vi.mock` call. */
export const sharedFakeSaf = createFakeSaf();

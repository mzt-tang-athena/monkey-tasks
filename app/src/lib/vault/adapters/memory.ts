import type { VaultAdapter, VaultEntry } from "../adapter";

/**
 * A vault held in memory: the web preview, the component tests and
 * Playwright run on it (ADR 0037). It behaves like the Android document
 * provider where the app can tell: a taken name gets " (1)", a create
 * takes its name before it awaits anything, a write to a missing file
 * fails, and a remove of a missing file does not.
 */

export const MEMORY_ROOT = "memory://vault";

/** Files by path under the root: "Tasks/Call.md" to its text. */
export type VaultSeed = Record<string, string>;

/** The calls a test can slow down or fail. */
export type VaultOp =
  | "list"
  | "findFolder"
  | "makeFolder"
  | "read"
  | "write"
  | "create"
  | "remove";

export type MemoryVaultOptions = {
  /** Every call waits this long before it acts. */
  latencyMs?: number;
  /** Return an error to fail this call. The uri is the file or folder
   * the call acts on; a create passes the name it asks for. */
  fail?: (op: VaultOp, uri: string) => Error | null | undefined;
};

/**
 * The memory vault from outside the app: what a test reads, writes and
 * breaks. Paths are relative to the root, "Tasks/Call.md".
 */
export type VaultTestHooks = {
  files(): VaultSeed;
  read(path: string): string | null;
  /** Write a file and its folders, as another app would. */
  write(path: string, text: string): void;
  reset(seed: VaultSeed): void;
  setLatency(ms: number): void;
  /** Fail the next `op` on the file or folder with this name. */
  failNext(op: VaultOp, name: string): void;
};

export type MemoryVault = VaultAdapter & { readonly hooks: VaultTestHooks };

type Node = { kind: "file"; text: string } | { kind: "folder" };

function nameOf(path: string): string {
  return path.slice(path.lastIndexOf("/") + 1);
}

function parentPath(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut === -1 ? "" : path.slice(0, cut);
}

export function createMemoryVault(
  seed: VaultSeed = {},
  options: MemoryVaultOptions = {},
): MemoryVault {
  /** Nodes by path. The root is the empty path. */
  const nodes = new Map<string, Node>();
  let latencyMs = options.latencyMs ?? 0;
  const failures: { op: VaultOp; name: string }[] = [];

  function uriOf(path: string): string {
    return path === "" ? MEMORY_ROOT : `${MEMORY_ROOT}/${path}`;
  }

  function pathOf(uri: string): string {
    if (uri === MEMORY_ROOT) {
      return "";
    }
    if (!uri.startsWith(`${MEMORY_ROOT}/`)) {
      throw new Error(`not a memory vault uri: ${uri}`);
    }
    return uri.slice(MEMORY_ROOT.length + 1);
  }

  function join(folder: string, name: string): string {
    return folder === "" ? name : `${folder}/${name}`;
  }

  function put(path: string, text: string): void {
    const parts = path.split("/");
    for (let depth = 1; depth < parts.length; depth += 1) {
      nodes.set(parts.slice(0, depth).join("/"), { kind: "folder" });
    }
    nodes.set(path, { kind: "file", text });
  }

  function reset(next: VaultSeed): void {
    nodes.clear();
    nodes.set("", { kind: "folder" });
    for (const [path, text] of Object.entries(next)) {
      put(path, text);
    }
  }
  reset(seed);

  function folderPath(uri: string): string {
    const path = pathOf(uri);
    if (nodes.get(path)?.kind !== "folder") {
      throw new Error(`not a folder: ${uri}`);
    }
    return path;
  }

  function childrenOf(folder: string): string[] {
    return [...nodes.keys()].filter(
      (path) => path !== "" && parentPath(path) === folder,
    );
  }

  /** The provider's own rename for a taken name: "x (1).md". */
  function unique(folder: string, name: string, isFolder: boolean): string {
    const dot = isFolder ? -1 : name.lastIndexOf(".");
    const base = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    for (let n = 1; nodes.has(join(folder, candidate)); n += 1) {
      candidate = `${base} (${n})${ext}`;
    }
    return join(folder, candidate);
  }

  /** Throw the error a test asked for, before the call does anything. */
  function check(op: VaultOp, uri: string): void {
    const name = nameOf(uri);
    const at = failures.findIndex(
      (failure) => failure.op === op && failure.name === name,
    );
    if (at !== -1) {
      failures.splice(at, 1);
      throw new Error(`${op} failed: ${name}`);
    }
    const error = options.fail?.(op, uri);
    if (error != null) {
      throw error;
    }
  }

  async function settle(): Promise<void> {
    if (latencyMs > 0) {
      const wait = latencyMs;
      await new Promise<void>((resolve) => setTimeout(resolve, wait));
    }
  }

  async function list(folderUri: string): Promise<VaultEntry[]> {
    check("list", folderUri);
    await settle();
    return childrenOf(folderPath(folderUri))
      .map((path) => ({
        uri: uriOf(path),
        name: nameOf(path),
        isFolder: nodes.get(path)?.kind === "folder",
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  const hooks: VaultTestHooks = {
    files() {
      return Object.fromEntries(
        [...nodes.entries()]
          .flatMap(([path, node]) =>
            node.kind === "file" ? [[path, node.text] as const] : [],
          )
          .sort(([a], [b]) => a.localeCompare(b)),
      );
    },
    read(path) {
      const node = nodes.get(path);
      return node?.kind === "file" ? node.text : null;
    },
    write: put,
    reset,
    setLatency(ms) {
      latencyMs = ms;
    },
    failNext(op, name) {
      failures.push({ op, name });
    },
  };

  return {
    kind: "memory",
    hooks,

    async savedRoot() {
      return MEMORY_ROOT;
    },

    async requestRoot() {
      return MEMORY_ROOT;
    },

    list,

    async findFolder(parentUri, name) {
      check("findFolder", `${parentUri}/${name}`);
      await settle();
      const path = join(folderPath(parentUri), name);
      return nodes.get(path)?.kind === "folder" ? uriOf(path) : null;
    },

    async makeFolder(parentUri, name) {
      check("makeFolder", `${parentUri}/${name}`);
      const path = unique(folderPath(parentUri), name, true);
      nodes.set(path, { kind: "folder" });
      await settle();
      return uriOf(path);
    },

    async read(uri) {
      check("read", uri);
      await settle();
      const node = nodes.get(pathOf(uri));
      if (node?.kind !== "file") {
        throw new Error(`no such file: ${uri}`);
      }
      return node.text;
    },

    async write(uri, text) {
      check("write", uri);
      await settle();
      const path = pathOf(uri);
      if (nodes.get(path)?.kind !== "file") {
        throw new Error(`no such file: ${uri}`);
      }
      nodes.set(path, { kind: "file", text });
    },

    async create(folderUri, fileName, text) {
      check("create", `${folderUri}/${fileName}`);
      // The name is taken now, before any wait, so two creates of one
      // name in the same tick get two names. The text lands after the
      // wait, as a provider writes into the file it made.
      const path = unique(folderPath(folderUri), fileName, false);
      nodes.set(path, { kind: "file", text: "" });
      await settle();
      if (nodes.get(path)?.kind === "file") {
        nodes.set(path, { kind: "file", text });
      }
      return { uri: uriOf(path), fileName: nameOf(path) };
    },

    async remove(uri) {
      check("remove", uri);
      await settle();
      const path = pathOf(uri);
      if (path === "") {
        throw new Error("the vault root cannot be removed");
      }
      for (const key of [...nodes.keys()]) {
        if (key === path || key.startsWith(`${path}/`)) {
          nodes.delete(key);
        }
      }
    },

    parentOf(uri) {
      const cut = uri.lastIndexOf("/");
      return cut === -1 ? "" : uri.slice(0, cut);
    },
  };
}

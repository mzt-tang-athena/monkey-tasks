import type { MemoryVault, VaultOp, VaultSeed } from "./adapters/memory";

/**
 * The memory vault's test hooks (ADR 0037). A test reaches the vault
 * through `globalThis.__vault`, and a page picks its seed, latency and
 * one failure from its query. Both work only with the hooks on.
 */

/** What `globalThis.__vault` holds. Paths are "Tasks/Call Mum.md". */
export type VaultTestApi = {
  files(): VaultSeed;
  read(path: string): string | null;
  write(path: string, text: string): void;
  /** A seed name, a comma list of them, or the files themselves. */
  reset(seed: string | VaultSeed): void;
  setLatency(ms: number): void;
  failNext(op: VaultOp, name: string): void;
};

declare global {
  var __vault: VaultTestApi | undefined;
}

const OPS: readonly VaultOp[] = [
  "list",
  "findFolder",
  "makeFolder",
  "read",
  "write",
  "create",
  "remove",
];

/**
 * The hooks are on in a dev build, and in a build made with
 * `EXPO_PUBLIC_VAULT_TEST_HOOKS=1`. A release APK has neither. Expo
 * inlines the variable at build time, so it must be read by its full
 * name.
 */
export function testHooksOn(
  dev: boolean = typeof __DEV__ !== "undefined" && __DEV__,
  flag: string | undefined = process.env.EXPO_PUBLIC_VAULT_TEST_HOOKS,
): boolean {
  return dev || flag === "1";
}

export type VaultQuery = {
  /** The seed names, in order. Absent means the preview's own set. */
  seeds?: string[];
  latencyMs?: number;
  fail?: { op: VaultOp; name: string };
};

/** Read `?vault=<seed>&latency=<ms>&fail=<op>:<file name>`. */
export function parseVaultQuery(search: string): VaultQuery {
  const params = new URLSearchParams(search);
  const query: VaultQuery = {};
  const vault = params.get("vault");
  if (vault != null) {
    query.seeds = seedNames(vault);
  }
  const latency = Number(params.get("latency"));
  if (params.has("latency") && Number.isFinite(latency) && latency >= 0) {
    query.latencyMs = latency;
  }
  const fail = params.get("fail");
  if (fail != null) {
    const cut = fail.indexOf(":");
    const op = fail.slice(0, cut) as VaultOp;
    if (cut === -1 || !OPS.includes(op)) {
      throw new Error(
        `?fail=${fail}: expected <call>:<file name>, with a call from ${OPS.join(", ")}`,
      );
    }
    query.fail = { op, name: fail.slice(cut + 1) };
  }
  return query;
}

/** "default,repair" to its names. An empty value is an empty vault. */
export function seedNames(list: string): string[] {
  return list
    .split(",")
    .map((name) => name.trim())
    .filter((name) => name !== "");
}

/** Put the vault on `globalThis.__vault`. */
export function installTestHooks(
  vault: MemoryVault,
  seedOf: (names: string[]) => VaultSeed,
): void {
  const { hooks } = vault;
  globalThis.__vault = {
    files: () => hooks.files(),
    read: (path) => hooks.read(path),
    write: (path, text) => hooks.write(path, text),
    reset: (seed) =>
      hooks.reset(typeof seed === "string" ? seedOf(seedNames(seed)) : seed),
    setLatency: (ms) => hooks.setLatency(ms),
    failNext: (op, name) => hooks.failNext(op, name),
  };
}

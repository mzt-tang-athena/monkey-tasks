import { afterEach, describe, expect, it, vi } from "vitest";
import { createMemoryVault } from "./adapters/memory";
import { defaultAdapter } from "./default-adapter.web";
import { installTestHooks, parseVaultQuery, testHooksOn } from "./test-hooks";

afterEach(() => {
  globalThis.__vault = undefined;
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("testHooksOn", () => {
  it("is on in a dev build or with the build flag, and off in a release", () => {
    expect(testHooksOn(true, undefined)).toBe(true);
    expect(testHooksOn(false, "1")).toBe(true);
    expect(testHooksOn(false, undefined)).toBe(false);
    expect(testHooksOn(false, "true")).toBe(false);
  });
});

describe("parseVaultQuery", () => {
  it("reads the seed, the latency and one failure", () => {
    expect(
      parseVaultQuery("?vault=default&latency=200&fail=write:Call Mum.md"),
    ).toEqual({
      seeds: ["default"],
      latencyMs: 200,
      fail: { op: "write", name: "Call Mum.md" },
    });
  });

  it("reads a list of seeds, and an empty one as an empty vault", () => {
    expect(parseVaultQuery("?vault=default,repair").seeds).toEqual([
      "default",
      "repair",
    ]);
    expect(parseVaultQuery("?vault=").seeds).toEqual([]);
    expect(parseVaultQuery("").seeds).toBeUndefined();
  });

  it("refuses a failure it cannot read", () => {
    expect(() => parseVaultQuery("?fail=write")).toThrow("expected <call>:<file name>");
    expect(() => parseVaultQuery("?fail=rename:Call.md")).toThrow(
      "expected <call>:<file name>",
    );
  });
});

describe("installTestHooks", () => {
  it("puts the vault on globalThis.__vault, with seeds by name", async () => {
    const vault = createMemoryVault({ "Tasks/Call.md": "call" });

    installTestHooks(vault, (names) =>
      Object.fromEntries(names.map((name) => [`Tasks/${name}.md`, name])),
    );
    const hooks = globalThis.__vault;

    expect(hooks?.files()).toEqual({ "Tasks/Call.md": "call" });
    hooks?.reset("Milk,Bread");
    expect(hooks?.files()).toEqual({
      "Tasks/Bread.md": "Bread",
      "Tasks/Milk.md": "Milk",
    });
    hooks?.failNext("read", "Milk.md");
    await expect(vault.read("memory://vault/Tasks/Milk.md")).rejects.toThrow();
  });
});

describe("the browser's vault", () => {
  it("has no test hooks and ignores the page query in a release build", () => {
    vi.stubGlobal("location", { search: "?vault=&fail=write:Call Mum.md" });

    const vault = defaultAdapter();

    expect(globalThis.__vault).toBeUndefined();
    expect(vault.kind).toBe("memory");
  });

  it("takes its seed, latency and failure from the page with the hooks on", async () => {
    vi.stubEnv("EXPO_PUBLIC_VAULT_TEST_HOOKS", "1");
    vi.stubGlobal("location", { search: "?vault=repair&fail=read:Broken note.md" });

    const vault = defaultAdapter();

    expect(Object.keys(globalThis.__vault?.files() ?? {})).toEqual([
      "Tasks/Broken note.md",
      "Tasks/Lists/Garden.md",
    ]);
    await expect(
      vault.read("memory://vault/Tasks/Broken note.md"),
    ).rejects.toThrow("read failed: Broken note.md");
  });
});

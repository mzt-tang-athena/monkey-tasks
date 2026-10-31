import { todayIso } from "@/utils/dates";
import type { VaultAdapter } from "./adapter";
import { createMemoryVault } from "./adapters/memory";
import { PREVIEW_SEEDS, sampleSeed } from "./sample/seed";
import { installTestHooks, parseVaultQuery, testHooksOn } from "./test-hooks";

/**
 * The vault in the browser preview: the memory adapter, seeded from the
 * sample notes with their dates moved to today. With the test hooks on,
 * the page query picks the seed, the latency and one failure, and the
 * vault is on `globalThis.__vault` (ticket 0051).
 */
export function defaultAdapter(): VaultAdapter {
  const hooks = testHooksOn();
  const query = hooks ? parseVaultQuery(globalThis.location?.search ?? "") : {};
  const seedOf = (names: string[]) => sampleSeed(names, todayIso());
  const vault = createMemoryVault(seedOf(query.seeds ?? PREVIEW_SEEDS), {
    latencyMs: query.latencyMs,
  });
  if (query.fail != null) {
    vault.hooks.failNext(query.fail.op, query.fail.name);
  }
  if (hooks) {
    installTestHooks(vault, seedOf);
  }
  return vault;
}

import type { VaultAdapter } from "./adapter";
import { safAdapter } from "./adapters/saf";

/**
 * The vault on a phone: the folder the user granted, through SAF. The
 * web build resolves `default-adapter.web.ts` instead, so the memory
 * adapter and the sample notes never ship in the APK.
 */
export function defaultAdapter(): VaultAdapter {
  return safAdapter;
}

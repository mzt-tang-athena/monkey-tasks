import { testHooksOn } from "@/lib/vault/test-hooks";
import { clearCrashLog, readCrashLog, reportCrash } from "./crash-log";

/**
 * The end-to-end suite writes a crash report and reads the file back
 * through `globalThis.__crash`. The web build has it only when it is
 * made with `EXPO_PUBLIC_VAULT_TEST_HOOKS=1`, as `npm run web:export`
 * does. A release APK has neither.
 */
export type CrashTestApi = {
  report(message: string): void;
  read(): string;
  reset(): void;
};

declare global {
  var __crash: CrashTestApi | undefined;
}

export function installCrashTestHooks(): void {
  if (!testHooksOn()) {
    return;
  }
  globalThis.__crash = {
    report: (message) =>
      reportCrash({ message, stack: new Error(message).stack }),
    read: () => readCrashLog(),
    reset: () => clearCrashLog(),
  };
}

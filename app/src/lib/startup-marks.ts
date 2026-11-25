/**
 * Cold start marks for the measure script. A build made with
 * `EXPO_PUBLIC_STARTUP_MARKS=1` logs one line per mark, with the
 * device's clock in milliseconds. A release APK has no flag, so Metro
 * drops every call. Expo inlines the variable at build time, so it
 * must be read by its full name.
 */
const on = process.env.EXPO_PUBLIC_STARTUP_MARKS === "1";

export function mark(name: string): void {
  if (on) {
    console.log(`startup-mark ${name} ${Date.now()}`);
  }
}

const seen = new Set<string>();

/** The first call with this name logs; later ones do nothing. */
export function markOnce(name: string): void {
  if (on && !seen.has(name)) {
    seen.add(name);
    mark(name);
  }
}

const totals = new Map<string, { n: number; sum: number; max: number }>();

const spans: { name: string; from: number; to: number }[] = [];

function add(name: string, from: number, to: number): void {
  const ms = to - from;
  const t = totals.get(name) ?? { n: 0, sum: 0, max: 0 };
  totals.set(name, { n: t.n + 1, sum: t.sum + ms, max: Math.max(t.max, ms) });
  spans.push({ name, from, to });
}

/** Run `fn` and add its time to the totals under `name`. */
export function timed<T>(name: string, fn: () => T): T {
  if (!on) {
    return fn();
  }
  const from = performance.now();
  try {
    return fn();
  } finally {
    add(name, from, performance.now());
  }
}

/** Await `fn` and add its time to the totals under `name`. */
export async function timedAsync<T>(
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!on) {
    return fn();
  }
  const from = performance.now();
  try {
    return await fn();
  } finally {
    add(name, from, performance.now());
  }
}

function logTotals(): void {
  for (const { name, from, to } of spans) {
    console.log(
      `startup-mark span:${name} ${(performance.timeOrigin + from).toFixed(0)} ${(performance.timeOrigin + to).toFixed(0)}`,
    );
  }
  for (const [name, t] of totals) {
    console.log(
      `startup-mark total:${name} n=${t.n} sum=${t.sum.toFixed(1)} max=${t.max.toFixed(1)}`,
    );
  }
}

type Hermes = {
  enableSamplingProfiler?: () => void;
  dumpSampledTraceToFile?: (path: string) => void;
  disableSamplingProfiler?: () => void;
};

const hermes = () =>
  (globalThis as { HermesInternal?: Hermes }).HermesInternal;

/** Start Hermes' sampling profiler, before any other module runs. */
export function startProfile(): void {
  if (on) {
    const h = hermes();
    console.log(
      `startup-mark hermes ${h == null ? "none" : Object.keys(h).join(",")}`,
    );
    h?.enableSamplingProfiler?.();
  }
}

/** Write the profile of the start to the app's cache folder. */
export function dumpProfile(
  path = "/data/data/dev.monkey.monkeytasks/cache/startup.cpuprofile",
): void {
  if (on) {
    hermes()?.disableSamplingProfiler?.();
    hermes()?.dumpSampledTraceToFile?.(path);
  }
}

/** The first rows are committed: mark it, then dump the profile. */
export function rowsReady(): void {
  if (on && !seen.has("rows-ready")) {
    markOnce("rows-ready");
    logTotals();
    setTimeout(() => dumpProfile(), 1500);
  }
}

/**
 * Cold start marks for the measure script. A build made with
 * `EXPO_PUBLIC_STARTUP_MARKS=1` logs one line per mark, with the
 * device's clock in milliseconds. A release APK has no flag, so Metro
 * drops every call. Expo inlines the variable at build time, so it
 * must be read by its full name.
 */
const on = process.env.EXPO_PUBLIC_STARTUP_MARKS === "1";

const seen = new Set<string>();

export function mark(name: string): void {
  if (on) {
    console.log(`startup-mark ${name} ${Date.now()}`);
  }
}

/** The first call with this name logs; later ones do nothing. */
export function markOnce(name: string): void {
  if (on && !seen.has(name)) {
    seen.add(name);
    mark(name);
  }
}

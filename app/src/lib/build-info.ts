import Constants from "expo-constants";

/** The version EAS stamped on the manifest. */
export function appVersion(): string {
  return Constants.expoConfig?.version ?? "unknown";
}

/**
 * The build channel. EAS does not put its channel on the manifest, so
 * the dev flag is the split the app can see.
 */
export function buildChannel(
  dev: boolean = typeof __DEV__ !== "undefined" && __DEV__,
): string {
  return dev ? "development" : "production";
}

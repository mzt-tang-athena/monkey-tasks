import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

/**
 * One small JSON value kept in the app's own folder, so it outlives the
 * process. The background task and the app read the same files. The web
 * preview keeps the value in local storage instead.
 */
export function readJson(fileName: string, webKey: string): unknown {
  try {
    if (Platform.OS === "web") {
      const text = globalThis.localStorage?.getItem(webKey);
      return text == null ? undefined : JSON.parse(text);
    }
    const file = new File(Paths.document, fileName);
    return file.exists ? JSON.parse(file.textSync()) : undefined;
  } catch {
    return undefined;
  }
}

/** False when the value could not be kept. */
export function writeJson(
  fileName: string,
  webKey: string,
  value: unknown,
): boolean {
  try {
    const text = JSON.stringify(value);
    if (Platform.OS === "web") {
      globalThis.localStorage?.setItem(webKey, text);
      return true;
    }
    new File(Paths.document, fileName).writeSync(text);
    return true;
  } catch {
    return false;
  }
}

import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

/**
 * App settings. They live in app-internal storage - web local
 * storage, or one JSON file in the app's documents directory on
 * native - never in the vault.
 */
export type TaskForm = "rows" | "pills";
export type SortMode = "due" | "manual";

export type Settings = {
  /** The planner's bottom section: rows or chips. */
  taskForm: TaskForm;
  /** The Lists screen's order: by due time, or the manual order. */
  sortMode: SortMode;
};

const DEFAULTS: Settings = { taskForm: "rows", sortMode: "due" };

const LOCAL_KEYS: Record<keyof Settings, string> = {
  taskForm: "monkey-tasks.task-form",
  sortMode: "monkey-tasks.sort-mode",
};

const FILE_NAME = "monkey-tasks-settings.json";

function readNative(): Partial<Settings> {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (!file.exists) {
      return {};
    }
    const parsed: unknown = JSON.parse(file.textSync());
    return parsed != null && typeof parsed === "object"
      ? (parsed as Partial<Settings>)
      : {};
  } catch {
    // Missing or unreadable file: fall back to the defaults.
    return {};
  }
}

function writeNative(next: Settings): void {
  try {
    new File(Paths.document, FILE_NAME).writeSync(JSON.stringify(next));
  } catch {
    // Ignore: the setting just does not persist this time.
  }
}

function pick<K extends keyof Settings>(
  key: K,
  value: unknown,
): Settings[K] | null {
  const allowed: Record<keyof Settings, readonly string[]> = {
    taskForm: ["rows", "pills"],
    sortMode: ["due", "manual"],
  };
  return typeof value === "string" && allowed[key].includes(value)
    ? (value as Settings[K])
    : null;
}

/** Every setting, with defaults for whatever is missing. */
export function loadSettings(): Settings {
  const saved: Partial<Settings> =
    Platform.OS === "web"
      ? Object.fromEntries(
          (Object.keys(LOCAL_KEYS) as (keyof Settings)[]).flatMap((key) => {
            try {
              const value = globalThis.localStorage?.getItem(LOCAL_KEYS[key]);
              return value == null ? [] : [[key, value]];
            } catch {
              return [];
            }
          }),
        )
      : readNative();
  const next = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS) as (keyof Settings)[]) {
    const value = pick(key, saved[key]);
    if (value != null) {
      Object.assign(next, { [key]: value });
    }
  }
  return next;
}

/** Persist one setting; the others keep their value. */
export function saveSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K],
): void {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(LOCAL_KEYS[key], value);
    } catch {
      // Ignore: the setting just does not persist this time.
    }
    return;
  }
  writeNative({ ...loadSettings(), [key]: value });
}

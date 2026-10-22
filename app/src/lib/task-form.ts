import { Platform } from "react-native";
import { File, Paths } from "expo-file-system";

/**
 * The planner's task-form setting (rows or pills). One global
 * setting for every planner mode. It lives in app-internal storage
 * - web local storage, or a settings file in the app's documents
 * directory on native - never in the vault.
 */
export type TaskForm = "rows" | "pills";

const LOCAL_KEY = "monkey-tasks.task-form";
const FILE_NAME = "monkey-tasks-settings.json";

function readNative(): TaskForm | null {
  try {
    const file = new File(Paths.document, FILE_NAME);
    if (file.exists) {
      const parsed: unknown = JSON.parse(file.textSync());
      if (
        parsed != null &&
        typeof parsed === "object" &&
        "taskForm" in parsed &&
        (parsed as { taskForm?: unknown }).taskForm === "pills"
      ) {
        return "pills";
      }
      if (
        parsed != null &&
        typeof parsed === "object" &&
        "taskForm" in parsed &&
        (parsed as { taskForm?: unknown }).taskForm === "rows"
      ) {
        return "rows";
      }
    }
  } catch {
    // Missing or unreadable file: fall back to the default.
  }
  return null;
}

function writeNative(form: TaskForm): void {
  try {
    const file = new File(Paths.document, FILE_NAME);
    file.writeSync(JSON.stringify({ taskForm: form }));
  } catch {
    // Ignore: the setting just does not persist this time.
  }
}

/** Read the setting; defaults to rows. */
export function loadTaskForm(): TaskForm {
  if (Platform.OS === "web") {
    try {
      const saved = globalThis.localStorage?.getItem(LOCAL_KEY);
      if (saved === "pills" || saved === "rows") {
        return saved;
      }
    } catch {
      // No storage available: default below.
    }
    return "rows";
  }
  return readNative() ?? "rows";
}

/** Persist the setting. */
export function saveTaskForm(form: TaskForm): void {
  if (Platform.OS === "web") {
    try {
      globalThis.localStorage?.setItem(LOCAL_KEY, form);
    } catch {
      // Ignore: the setting just does not persist this time.
    }
    return;
  }
  writeNative(form);
}

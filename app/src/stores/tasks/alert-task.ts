import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { performAlertPress, pressOf } from "./alert-actions";
import { defaultAdapter } from "@/lib/vault/default-adapter";
import { readTaskResponse } from "@/lib/notifications";

/**
 * Runs a Done or Reschedule press when no screen is open. Android loads
 * the app's bundle without a UI for it, and this file is one of the
 * first things the entry file imports, so the task is defined by then.
 */
export const ALERT_ACTION_TASK = "monkey-tasks-alert-action";

if (Platform.OS === "android") {
  TaskManager.defineTask(ALERT_ACTION_TASK, async ({ data }) => {
    const response = readTaskResponse(data);
    const press = response == null ? null : pressOf(response);
    if (press != null) {
      await performAlertPress(defaultAdapter(), press);
    }
  });
  Notifications.registerTaskAsync(ALERT_ACTION_TASK).catch(() => undefined);
}

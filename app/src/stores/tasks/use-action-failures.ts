import * as React from "react";
import { AppState } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { actionLabel } from "@/lib/alerts/actions";
import {
  clearActionFailure,
  loadActionFailures,
  onActionFailures,
  type ActionFailure,
} from "@/lib/alerts/action-failures";
import { clearActionFailureNotice } from "@/lib/notifications";
import { defaultAdapter } from "@/lib/vault/default-adapter";
import { performAlertPress } from "./alert-actions";
import { TASKS_KEY } from "./query";
import type { VaultFailure } from "./use-vault-failures";

/**
 * The button presses that did not reach the vault, as failure lines.
 * A press from a killed app wrote its failure to a file, so the list
 * reads the file when the app opens and when it comes forward.
 */
export function useActionFailures(): VaultFailure[] {
  const client = useQueryClient();
  const [records, setRecords] = React.useState(loadActionFailures);

  React.useEffect(() => {
    const refresh = () => setRecords(loadActionFailures());
    refresh();
    const stop = onActionFailures(refresh);
    const state = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        refresh();
      }
    });
    return () => {
      stop();
      state.remove();
    };
  }, []);

  return React.useMemo(
    () =>
      records.map((record: ActionFailure): VaultFailure => {
        const dismiss = () => {
          clearActionFailure(record.id);
          void clearActionFailureNotice(record.id).catch(() => undefined);
        };
        const retry = () => {
          void performAlertPress(
            defaultAdapter(),
            {
              uri: record.uri,
              action: record.action,
              name: record.name,
              key: `retry|${record.id}|${Date.now()}`,
            },
            { retry: true },
          ).then(() => client.invalidateQueries({ queryKey: [TASKS_KEY] }));
        };
        return {
          key: record.id,
          kind: "failure",
          label: `${actionLabel(record.action)}: ${record.name}`,
          message: record.message,
          dismiss,
          retry,
        };
      }),
    [client, records],
  );
}

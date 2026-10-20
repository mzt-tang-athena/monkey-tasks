import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text } from "react-native";
import { getSavedVaultUri, requestVaultAccess } from "../features/vault/grant";
import { listDirectory } from "../features/vault/scan";
import {
  listScheduled,
  exactAlarmState,
  scheduleAt,
} from "../features/reminders/schedule";

/**
 * Dev-only diagnostics from the spike: alarm state, scheduled
 * notifications, and a quick folder peek.
 */
export default function DevScreen() {
  const [alarm, setAlarm] = React.useState("checking...");
  const [scheduled, setScheduled] = React.useState<
    { id: string; title?: string; when?: number }[]
  >([]);
  const [message, setMessage] = React.useState("");

  const refresh = React.useCallback(async () => {
    setAlarm((await exactAlarmState()) ? "exact alarms granted" : "exact alarms DENIED");
    setScheduled(await listScheduled());
  }, []);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const exact = await exactAlarmState();
      const items = await listScheduled();
      if (active) {
        setAlarm(exact ? "exact alarms granted" : "exact alarms DENIED");
        setScheduled(items);
      }
    })();
    return () => {
      active = false;
    };
  }, [refresh]);

  const test = async () => {
    try {
      const id = await scheduleAt(
        new Date(Date.now() + 10_000),
        "monkey-tasks",
        "10s test fired",
      );
      setMessage(`Scheduled ${id.slice(0, 8)} in 10s`);
    } catch (error) {
      setMessage(`Schedule failed: ${String(error)}`);
    }
  };

  const peek = async () => {
    const uri = await getSavedVaultUri();
    if (!uri) {
      setMessage("No vault folder saved.");
      return;
    }
    try {
      const entries = await listDirectory(uri);
      setMessage(`Root has ${entries.length} entries.`);
    } catch (error) {
      setMessage(`List failed: ${String(error)}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Text style={styles.line}>{alarm}</Text>
      <Text style={styles.line}>{scheduled.length} notification(s) scheduled</Text>
      {scheduled.map((item) => (
        <Text key={item.id} style={styles.sub}>
          {item.id.slice(0, 8)}: {item.title ?? "(no title)"}
          {item.when ? ` at ${new Date(item.when).toLocaleTimeString()}` : ""}
        </Text>
      ))}
      <Pressable style={styles.button} onPress={refresh}>
        <Text style={styles.buttonText}>Refresh</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={test}>
        <Text style={styles.buttonText}>Test: 10s</Text>
      </Pressable>
      <Pressable style={styles.button} onPress={peek}>
        <Text style={styles.buttonText}>Peek at vault root</Text>
      </Pressable>
      <Pressable
        style={styles.button}
        onPress={async () => {
          await requestVaultAccess();
          await refresh();
        }}
      >
        <Text style={styles.buttonText}>Grant vault folder</Text>
      </Pressable>
      <Text style={styles.line}>{message}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    padding: 16,
    gap: 8,
  },
  line: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  sub: {
    fontSize: 12,
    fontFamily: "monospace",
    color: "#555555",
    marginLeft: 12,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: "#1d3fbf",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    marginTop: 4,
  },
  buttonText: {
    color: "#ffffff",
    fontWeight: "600",
  },
});

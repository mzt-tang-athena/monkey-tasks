import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import * as FileSystem from "expo-file-system/legacy";
import * as Notifications from "expo-notifications";
import { AndroidImportance } from "expo-notifications";
import { parseCapture, formatToday } from "./capture";

const { StorageAccessFramework } = FileSystem;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

const PERMISSION_FILE = "vault-folder.txt";
const CHANNEL_ID = "spike";

type FrontmatterValue = string | string[];

type Note = {
  uri: string;
  name: string;
  text: string;
  values: Record<string, FrontmatterValue>;
  body: string;
};

function lastSegment(uri: string): string {
  const segment = uri.split("/").pop() ?? uri;
  return decodeURIComponent(segment);
}

function parseFrontmatter(text: string): {
  raw: string | null;
  values: Record<string, FrontmatterValue>;
  body: string;
} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
  if (!match) {
    return { raw: null, values: {}, body: text };
  }
  const values: Record<string, FrontmatterValue> = {};
  let currentKey: string | null = null;
  for (const line of match[1].split(/\r?\n/)) {
    const listItem = /^ {2}- (.*)$/.exec(line);
    if (listItem && currentKey) {
      const existing = values[currentKey];
      const list = Array.isArray(existing) ? [...existing] : [];
      if (existing !== undefined && !Array.isArray(existing)) {
        list.push(existing);
      }
      list.push(listItem[1]);
      values[currentKey] = list;
      continue;
    }
    const pair = /^([^:\s][^:]*):\s?(.*)$/.exec(line);
    if (pair) {
      currentKey = pair[1].trim();
      values[currentKey] = pair[2];
    }
  }
  return { raw: match[1], values, body: text.slice(match[0].length) };
}

function setStatusLine(text: string, status: string): string {
  const pattern = /^(\s*status:).*$/m;
  if (!pattern.test(text)) {
    throw new Error("no status line in frontmatter");
  }
  return text.replace(pattern, `$1 "[[${status}]]"`);
}

async function readPermissionFile(): Promise<string | null> {
  const uri = `${FileSystem.documentDirectory}${PERMISSION_FILE}`;
  const info = await FileSystem.getInfoAsync(uri);
  if (!info.exists) {
    return null;
  }
  const value = await FileSystem.readAsStringAsync(uri);
  return value.trim() === "" ? null : value;
}

async function writePermissionFile(folderUri: string | null): Promise<void> {
  const uri = `${FileSystem.documentDirectory}${PERMISSION_FILE}`;
  await FileSystem.writeAsStringAsync(uri, folderUri ?? "", {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

async function listDirectory(
  folderUri: string,
): Promise<{ uri: string; name: string; isFile: boolean }[]> {
  const uris = await StorageAccessFramework.readDirectoryAsync(folderUri);
  return uris
    .map((uri) => {
      const name = lastSegment(uri);
      return { uri, name, isFile: name.includes(".") };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

async function ensureNotificationPermission(): Promise<boolean> {
  const settings = await Notifications.getPermissionsAsync();
  if (settings.granted) {
    return true;
  }
  const request = await Notifications.requestPermissionsAsync();
  return request.granted;
}

async function scheduleSpikeNotification(seconds: number): Promise<string> {
  const granted = await ensureNotificationPermission();
  if (!granted) {
    throw new Error("notification permission not granted");
  }
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: "Spike reminders",
    importance: AndroidImportance.MAX,
  });
  return Notifications.scheduleNotificationAsync({
    content: {
      title: "monkey-tasks spike",
      body: `Fired ${seconds}s after scheduling, at ${new Date().toLocaleTimeString()}`,
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: new Date(Date.now() + seconds * 1000),
      channelId: CHANNEL_ID,
      delivery: "alarmClock",
    },
  });
}

function RowButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.button,
        disabled && styles.buttonDisabled,
        pressed && styles.buttonPressed,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.buttonLabel}>{label}</Text>
    </Pressable>
  );
}

export default function App() {
  const [folderUri, setFolderUri] = React.useState<string | null>(null);
  const [currentDir, setCurrentDir] = React.useState<string | null>(null);
  const [tasksDir, setTasksDir] = React.useState<string | null>(null);
  const rootUriRef = React.useRef<string | null>(null);
  const [entries, setEntries] = React.useState<
    { uri: string; name: string; isFile: boolean }[]
  >([]);
  const [note, setNote] = React.useState<Note | null>(null);
  const [message, setMessage] = React.useState("No vault folder granted yet.");
  const [scheduled, setScheduled] = React.useState<
    { id: string; trigger: string }[]
  >([]);
  const [alarmState, setAlarmState] = React.useState<string>("unknown");

  const refreshScheduled = React.useCallback(async () => {
    const requests = await Notifications.getAllScheduledNotificationsAsync();
    setScheduled(
      requests.map((request) => {
        const trigger = request.trigger as Record<string, unknown>;
        const when =
          typeof trigger === "object" && trigger !== null
            ? JSON.stringify({ ...trigger, channelId: undefined })
            : String(trigger);
        return { id: request.identifier, trigger: when };
      }),
    );
    const exact = await Notifications.getExactAlarmPermissionsAsync();
    setAlarmState(exact.granted ? "exact alarms granted" : "exact alarms DENIED");
  }, []);

  React.useEffect(() => {
    let active = true;
    void (async () => {
      const requests = await Notifications.getAllScheduledNotificationsAsync();
      if (!active) {
        return;
      }
      setScheduled(
        requests.map((request) => {
          const trigger = request.trigger as Record<string, unknown>;
          const when =
            typeof trigger === "object" && trigger !== null
              ? JSON.stringify({ ...trigger, channelId: undefined })
              : String(trigger);
          return { id: request.identifier, trigger: when };
        }),
      );
      const exact = await Notifications.getExactAlarmPermissionsAsync();
      if (active) {
        setAlarmState(exact.granted ? "exact alarms granted" : "exact alarms DENIED");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const openDirectory = React.useCallback(async (uri: string) => {
    try {
      const listed = await listDirectory(uri);
      setEntries(listed);
      setCurrentDir(uri);
      setNote(null);
      if (rootUriRef.current === uri) {
        const tasks = listed.find((entry) => !entry.isFile && entry.name === "Tasks");
        setTasksDir(tasks?.uri ?? null);
        setMessage(
          tasks
            ? `${listed.length} entries in vault root`
            : "No Tasks folder in the vault root yet. Create it in Obsidian, then sync.",
        );
      } else {
        setMessage(`${listed.length} entries in ${lastSegment(uri) || "vault root"}`);
      }
    } catch (error) {
      setMessage(`List failed: ${String(error)}`);
    }
  }, []);

  const grantVault = React.useCallback(async () => {
    const result = await StorageAccessFramework.requestDirectoryPermissionsAsync();
    if (!result.granted) {
      setMessage("Folder permission denied.");
      return;
    }
    await writePermissionFile(result.directoryUri);
    rootUriRef.current = result.directoryUri;
    setFolderUri(result.directoryUri);
    await openDirectory(result.directoryUri);
  }, [openDirectory]);

  const restoreVault = React.useCallback(async (uri: string) => {
    try {
      rootUriRef.current = uri;
      await openDirectory(uri);
      setFolderUri(uri);
      setMessage("Restored saved vault folder.");
    } catch {
      setMessage("Saved folder permission no longer valid. Grant it again.");
    }
  }, [openDirectory]);

  React.useEffect(() => {
    readPermissionFile().then((saved) => {
      if (saved) {
        restoreVault(saved);
      }
    });
  }, [restoreVault]);

  const [input, setInput] = React.useState("");

  const capture = React.useCallback(async () => {
    let dir = tasksDir;
    if (!dir && rootUriRef.current) {
      const listed = await listDirectory(rootUriRef.current);
      const tasks = listed.find((entry) => !entry.isFile && entry.name === "Tasks");
      dir = tasks?.uri ?? null;
      setTasksDir(dir);
    }
    if (!dir) {
      setMessage("Capture needs the Tasks folder. Grant the vault folder first.");
      return;
    }
    const parsed = parseCapture(input);
    if (!parsed) {
      setMessage("Nothing to capture.");
      return;
    }
    const lines = [
      "---",
      'kind: "[[tasks]]"',
      `created: ${formatToday()}`,
    ];
    if (parsed.due) {
      lines.push(`due: ${parsed.due}`);
    }
    if (parsed.reminders?.length) {
      lines.push("reminders:");
      for (const reminder of parsed.reminders) {
        lines.push(`  - ${reminder}`);
      }
    }
    if (parsed.recurrence) {
      lines.push(`recurrence: "${parsed.recurrence}"`);
    }
    lines.push("lists:", "---", "", parsed.name);
    const content = `${lines.join("\n")}\n`;
    try {
      const fileUri = await StorageAccessFramework.createFileAsync(
        dir,
        `${parsed.name}.md`,
        "text/markdown",
      );
      await FileSystem.writeAsStringAsync(fileUri, content, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      setInput("");
      setMessage(
        `Captured "${parsed.name}"` +
          (parsed.due ? `, due ${parsed.due}` : ", no date") +
          (parsed.recurrence ? `, ${parsed.recurrence}` : ""),
      );
      if (currentDir) {
        await openDirectory(currentDir);
      }
    } catch (error) {
      setMessage(`Capture failed: ${String(error)}`);
    }
  }, [input, tasksDir, currentDir, openDirectory]);

  const openFile = React.useCallback(async (uri: string, name: string) => {
    try {
      const text = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      const { values, body } = parseFrontmatter(text);
      setNote({ uri, name, text, values, body });
      setMessage(`Read ${name}`);
    } catch (error) {
      setMessage(`Read failed: ${String(error)}`);
    }
  }, []);

  const writeStatus = React.useCallback(
    async (status: string) => {
      if (!note) {
        return;
      }
      try {
        const updated = setStatusLine(note.text, status);
        await FileSystem.writeAsStringAsync(note.uri, updated, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const reread = await FileSystem.readAsStringAsync(note.uri, {
          encoding: FileSystem.EncodingType.UTF8,
        });
        const { values, body } = parseFrontmatter(reread);
        setNote({ ...note, text: reread, values, body });
        setMessage(`Wrote status ${status} to ${note.name}. Check Obsidian next sync.`);
      } catch (error) {
        setMessage(`Write failed: ${String(error)}`);
      }
    },
    [note],
  );

  const schedule = React.useCallback(async (seconds: number) => {
    try {
      const id = await scheduleSpikeNotification(seconds);
      setMessage(
        seconds >= 60
          ? `Scheduled ${id} in ${seconds}s. Reboot now to test survival.`
          : `Scheduled ${id} in ${seconds}s. Lock the phone.`,
      );
    } catch (error) {
      setMessage(`Schedule failed: ${String(error)}`);
    }
  }, []);

  return (
    <View style={styles.screen}>
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.heading}>monkey-tasks vault spike</Text>
        <Text style={styles.message}>{message}</Text>

        <Text style={styles.section}>Capture</Text>
        <TextInput
          style={styles.input}
          placeholder="call the dentist tuesday 3pm repeat monthly"
          value={input}
          onChangeText={setInput}
          onSubmitEditing={capture}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        <RowButton label="Capture task" onPress={capture} disabled={!folderUri} />

        <RowButton label="Grant vault folder" onPress={grantVault} />
        {folderUri ? (
          <Text style={styles.folder}>Vault: {lastSegment(folderUri) || "root"}</Text>
        ) : null}

        <Text style={styles.section}>Diagnostics</Text>
        <Text style={styles.rowText}>{alarmState}</Text>
        <Text style={styles.rowText}>
          {scheduled.length} notification(s) scheduled right now
        </Text>
        {scheduled.map((item) => (
          <Text key={item.id} style={styles.rowText}>
            {item.id.slice(0, 8)}: {item.trigger}
          </Text>
        ))}
        <RowButton label="Refresh scheduled list" onPress={refreshScheduled} />

        <Text style={styles.section}>Notes</Text>
        {entries.map((entry) => (
          <Pressable
            key={entry.uri}
            style={styles.row}
            onPress={() =>
              entry.isFile
                ? openFile(entry.uri, entry.name)
                : openDirectory(entry.uri)
            }
          >
            <Text style={entry.isFile ? styles.rowText : styles.rowDir}>
              {entry.isFile ? entry.name : `${entry.name}/`}
            </Text>
          </Pressable>
        ))}

        {note ? (
          <>
            <Text style={styles.section}>Frontmatter: {note.name}</Text>
            {Object.entries(note.values).map(([key, value]) => (
              <Text key={key} style={styles.rowText}>
                {key}: {Array.isArray(value) ? value.join(", ") : value}
              </Text>
            ))}
            <Text style={styles.section}>Set status and write back</Text>
            <View style={styles.buttonRow}>
              {["backlog", "active", "done"].map((status) => (
                <RowButton
                  key={status}
                  label={status}
                  onPress={() => writeStatus(status)}
                />
              ))}
            </View>
            <Text style={styles.section}>Body</Text>
            <Text style={styles.rowText}>{note.body || "(empty)"}</Text>
          </>
        ) : null}

        <Text style={styles.section}>Notifications</Text>
        <View style={styles.buttonRow}>
          <RowButton label="Test: 10s" onPress={() => schedule(10)} />
          <RowButton label="Reboot test: 120s" onPress={() => schedule(120)} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#ffffff",
  },
  content: {
    padding: 16,
    gap: 8,
    paddingBottom: 48,
  },
  heading: {
    fontSize: 22,
    fontWeight: "700",
  },
  message: {
    color: "#555555",
  },
  section: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 12,
  },
  folder: {
    color: "#777777",
  },
  row: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#dddddd",
  },
  rowText: {
    fontSize: 14,
    fontFamily: "monospace",
  },
  rowDir: {
    fontSize: 14,
    fontWeight: "600",
  },
  buttonRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  button: {
    backgroundColor: "#1d3fbf",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonPressed: {
    backgroundColor: "#3a5ad9",
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonLabel: {
    color: "#ffffff",
    fontWeight: "600",
  },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#999999",
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
});

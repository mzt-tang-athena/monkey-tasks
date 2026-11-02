import * as React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { getSavedVaultUri, requestVaultAccess } from "@/lib/vault/grant";
import { listDirectory } from "@/lib/vault/scan";
import {
  listScheduled,
  exactAlarmState,
  scheduleAt,
} from "@/lib/notifications";
import { insightLines, useInsights } from "@/features/diagnostics/hooks/use-insights";
import {
  THEMES,
  colors,
  radius,
  setDevTheme,
  spacing,
  type ThemeName,
} from "@/theme/tokens";

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
  const insights = useInsights();

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
      <View style={styles.section}>
        <Text style={styles.label}>layout</Text>
        {insightLines(insights).map((line) => (
          <Text key={line} style={styles.line}>
            {line}
          </Text>
        ))}
      </View>
      <View style={styles.section}>
        <Text style={styles.label}>alarms</Text>
        <Text style={styles.line}>{alarm}</Text>
        <Text style={styles.line}>{scheduled.length} notification(s) scheduled</Text>
        {scheduled.map((item) => (
          <Text key={item.id} style={styles.sub}>
            {item.id.slice(0, 8)}: {item.title ?? "(no title)"}
            {item.when ? ` at ${new Date(item.when).toLocaleTimeString()}` : ""}
          </Text>
        ))}
      </View>
      <View style={styles.actions}>
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
      </View>
      <ThemeSwitcher />
    </ScrollView>
  );
}

/** Dev-only theme switcher: three swatches, one per named theme. */
function ThemeSwitcher() {
  return (
    <View style={styles.switcher}>
      <Text style={styles.switcherLabel}>theme (reload applies)</Text>
      <View style={styles.swatchRow}>
        {(Object.keys(THEMES) as ThemeName[]).map((name) => (
          <Pressable
            key={name}
            style={[styles.swatch, { backgroundColor: THEMES[name].accent }]}
            onPress={() => setDevTheme(name)}
            accessibilityRole="button"
            accessibilityLabel={`theme ${name}`}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // The page owns the space between its blocks; each block owns the
  // space between its lines.
  content: {
    padding: spacing.l,
    gap: spacing.l,
  },
  section: {
    gap: spacing.s,
  },
  actions: {
    gap: spacing.m,
  },
  label: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "monospace",
    color: colors.inkFaint,
    textTransform: "uppercase",
    letterSpacing: 1.2,
  },
  line: {
    fontSize: 14,
    fontFamily: "monospace",
    color: colors.ink,
  },
  // A scheduled alarm, indented under the count.
  sub: {
    fontSize: 12,
    fontFamily: "monospace",
    color: colors.inkMuted,
    paddingLeft: spacing.m,
  },
  button: {
    alignSelf: "flex-start",
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  buttonText: {
    color: colors.onAccent,
    fontWeight: "600",
  },
  switcher: {
    gap: spacing.s,
  },
  switcherLabel: {
    fontSize: 12,
    fontFamily: "monospace",
    color: colors.inkMuted,
  },
  swatchRow: {
    flexDirection: "row",
    gap: 8,
  },
  swatch: {
    width: 32,
    height: 32,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
  },
});

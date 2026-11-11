import * as React from "react";
import { Share, StyleSheet, Text, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { Button } from "@/components/ui/button";
import {
  CRASH_LOG_MAX_BYTES,
  crashCount,
  latestCrashEntry,
  readCrashLog,
  utf8Bytes,
} from "@/lib/crash-log";
import { spacing, type, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";

const PREVIEW_LIMIT = 1400;

/** The newest entry, short enough to read on a phone. Copy and Share
    send the whole file, not this preview. */
function preview(entry: string): string {
  return entry.length <= PREVIEW_LIMIT
    ? entry
    : `${entry.slice(0, PREVIEW_LIMIT)}\n…`;
}

function kb(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${Math.ceil(bytes / 1024)} KB`;
}

/**
 * The crash log, in the Diagnostics section. It reads the app's own
 * file, never the vault, and offers the two ways off the phone:
 * Copy, and the system share sheet.
 */
export function CrashLogCard() {
  const { styles } = useThemedStyles(makeStyles);
  const [log] = React.useState(readCrashLog);
  const [note, setNote] = React.useState("");

  const count = crashCount(log);
  const empty = log.trim() === "";
  const entry = latestCrashEntry(log);

  const copy = React.useCallback(async () => {
    try {
      await Clipboard.setStringAsync(log);
      setNote("Copied the crash log.");
    } catch {
      setNote("Could not copy the crash log.");
    }
  }, [log]);

  const share = React.useCallback(async () => {
    try {
      await Share.share({ title: "monkey-tasks crash log", message: log });
      setNote("Shared the crash log.");
    } catch {
      setNote("Could not open the share sheet.");
    }
  }, [log]);

  return (
    <View testID="crash-log" style={styles.field}>
      <Text style={styles.fieldLabel}>Crash log</Text>
      {empty ? (
        <Text style={styles.empty}>No crashes recorded.</Text>
      ) : (
        <Text style={styles.meta} testID="crash-log-summary">
          {count === 1 ? "1 crash" : `${count} crashes`} · {kb(utf8Bytes(log))} of{" "}
          {kb(CRASH_LOG_MAX_BYTES)}
        </Text>
      )}
      <View style={styles.actions}>
        <Button
          variant="text"
          label="Copy"
          accessibilityLabel="Copy crash log"
          disabled={empty}
          onPress={() => void copy()}
        />
        <Button
          variant="text"
          label="Share"
          accessibilityLabel="Share crash log"
          disabled={empty}
          onPress={() => void share()}
        />
      </View>
      {note === "" ? null : <Text style={styles.note}>{note}</Text>}
      {empty ? null : (
        <Text selectable style={styles.entry} testID="crash-log-entry">
          {preview(entry)}
        </Text>
      )}
      <Text style={styles.fieldHint}>
        An error on the animation thread is not recorded here.
      </Text>
    </View>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    field: {
      gap: spacing.s,
      padding: spacing.m,
    },
    fieldLabel: {
      ...type.eyebrow,
      color: colors.inkMuted,
    },
    fieldHint: {
      ...type.caption,
      color: colors.inkMuted,
    },
    empty: {
      ...type.body,
      color: colors.ink,
    },
    meta: {
      ...type.caption,
      color: colors.inkMuted,
    },
    // The log is monospace, like the dev screen, so a stack stays
    // aligned. The newest entry is a preview; Copy sends it all.
    entry: {
      fontSize: 12,
      lineHeight: 16,
      fontFamily: "monospace",
      color: colors.ink,
    },
    actions: {
      flexDirection: "row",
      gap: spacing.s,
    },
    note: {
      ...type.caption,
      color: colors.inkMuted,
    },
  }),
});

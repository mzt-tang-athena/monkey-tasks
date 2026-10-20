import * as React from "react";
import { Platform, Pressable, StyleSheet, Text, TextInput, View, type TextStyle } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { colors, fonts, spacing, radii } from "../theme/tokens";

// Web keeps a focus ring, but themed to the accent instead of the
// browser default black. The longhands are web-only styles.
const webFocusRing = Platform.select({
  web: {
    outlineColor: colors.accent,
    outlineStyle: "solid",
    outlineWidth: 2,
  } as unknown as TextStyle,
  default: {},
});

/**
 * The single bottom bar, shared by both tabs. Left: the Lists and
 * Planner nav items, icon plus label with an active dot. Right: the
 * capture field, a compact rounded rect with the send button inside
 * its right edge. The target-list pill is hidden until the field is
 * focused; focusing also expands the bar upward to show the parse
 * preview and the details affordance.
 */
export function BottomBar({
  targets,
  defaultTargetIndex,
  onSend,
  onOpenDetails,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
  /** Opens the full sheet with the draft text, when details matter. */
  onOpenDetails?: (draft: string, targetIndex: number) => void;
}) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [text, setText] = React.useState("");
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [focused, setFocused] = React.useState(false);
  const [sending, setSending] = React.useState(false);

  const parsed = text.trim() ? parseCapture(text) : null;
  const canSend = text.trim() !== "" && !sending;
  const expanded = focused || text.trim() !== "";

  const send = () => {
    const capture = parsed;
    if (!capture || sending) {
      return;
    }
    setSending(true);
    onSend(capture, targets[targetIndex] ?? targets[0]);
    setText("");
    setSending(false);
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {/* Expanded state: the parse preview grows upward from the field. */}
      {expanded ? (
        <View style={styles.previewRow}>
          {parsed && parsed.name !== "" ? (
            <Text style={styles.preview} numberOfLines={1}>
              {parsed.matches?.length
                ? `parsed: ${parsed.matches.map((m) => m.text).join(", ")}`
                : "no date"}
              {" -> "}
              {parsed.name}
            </Text>
          ) : (
            <Text style={[styles.preview, styles.previewHint]}>
              {'Try "tomorrow" or "friday 9am" for a date.'}
            </Text>
          )}
          {onOpenDetails != null && text.trim() !== "" ? (
            <Pressable
              style={({ pressed }) => [
                styles.details,
                pressed && styles.detailsPressed,
              ]}
              onPress={() => {
                setFocused(false);
                onOpenDetails(text, targetIndex);
              }}
              accessibilityLabel="open capture details"
              accessibilityRole="button"
            >
              <Text style={styles.detailsText}>details</Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      <View style={styles.row}>
        <IconTab
          label="Lists"
          active={pathname === "/"}
          onPress={() => router.navigate("/")}
          icon={<ListGlyph active={pathname === "/"} />}
        />
        <IconTab
          label="Planner"
          active={pathname === "/planner"}
          onPress={() => router.navigate("/planner")}
          icon={<CalendarGlyph active={pathname === "/planner"} />}
        />

        {/* The target pill only exists while the field is focused. */}
        {focused ? (
          <Pressable
            style={({ pressed }) => [
              styles.pill,
              pressed && styles.pillPressed,
            ]}
            onPress={() =>
              setTargetIndex((index) => (index + 1) % targets.length)
            }
            accessibilityRole="button"
            accessibilityLabel="target list"
          >
            <Text style={styles.pillText}>
              {targetLabel(targets[targetIndex] ?? targets[0])}
            </Text>
          </Pressable>
        ) : null}

        {/* The field: rounded rect, send inside the right edge. */}
        <View style={[styles.field, webFocusRing]}>
          <TextInput
            style={styles.input}
            placeholder="Add a task"
            placeholderTextColor={colors.inkFaint}
            value={text}
            onChangeText={setText}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline={false}
          />
          <Pressable
            style={({ pressed }) => [
              styles.send,
              pressed && canSend && styles.sendPressed,
              !canSend && styles.sendDisabled,
            ]}
            onPress={send}
            disabled={!canSend}
            accessibilityRole="button"
            accessibilityLabel="add task"
            accessibilityState={{ disabled: !canSend }}
          >
            <Text
              style={[styles.sendText, !canSend && styles.sendTextDisabled]}
            >
              {"↑"}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

function IconTab({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: React.ReactNode;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tab, pressed && styles.tabPressed]}
      onPress={onPress}
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
    >
      {icon}
      <View style={styles.tabTextRow}>
        <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
          {label}
        </Text>
        {active ? <View style={styles.activeDot} /> : null}
      </View>
    </Pressable>
  );
}

function targetLabel(target: CaptureTarget): string {
  return target.kind === "main" ? "Main" : target.name;
}

/** Simple glyphs built from hairline views; no icon font. */
function ListGlyph({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={styles.glyphList}>
      <View style={[styles.glyphLine, { backgroundColor: color, width: 18 }]} />
      <View style={[styles.glyphLine, { backgroundColor: color, width: 13 }]} />
      <View style={[styles.glyphLine, { backgroundColor: color, width: 18 }]} />
    </View>
  );
}

function CalendarGlyph({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={[styles.glyphCalendar, { borderColor: color }]}>
      <View style={[styles.glyphCalendarTop, { backgroundColor: color }]} />
      <View style={[styles.glyphCalendarDot, { backgroundColor: color }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
    gap: spacing.xs,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },

  // Nav items: icon over label, an accent dot marks the active tab.
  tab: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: spacing.xs,
    borderRadius: radii.m,
  },
  tabPressed: {
    backgroundColor: colors.pressed,
  },
  tabTextRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    marginTop: 3,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  activeDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  glyphList: {
    height: 12,
    alignItems: "flex-start",
    gap: 3,
  },
  glyphLine: {
    height: 2,
    borderRadius: 1,
  },
  glyphCalendar: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderRadius: 4,
    overflow: "hidden",
  },
  glyphCalendarTop: {
    height: 4,
    width: "100%" as const,
  },
  glyphCalendarDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginLeft: 3,
    marginTop: 3,
  },

  // Target pill, focused state only.
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    minHeight: 36,
    justifyContent: "center",
  },
  pillPressed: {
    backgroundColor: colors.pressed,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },

  // The capture field: a rounded rect, not a pill, not a circle.
  field: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    borderRadius: radii.m,
    paddingLeft: spacing.m,
    paddingRight: spacing.xs,
    minHeight: 36,
    gap: spacing.s,
  },
  input: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
    minHeight: 36,
  },
  send: {
    width: 26,
    height: 26,
    borderRadius: radii.s,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendPressed: {
    backgroundColor: colors.accentDeep,
  },
  sendDisabled: {
    backgroundColor: colors.pressed,
  },
  sendText: {
    color: colors.onAccent,
    fontSize: 14,
    lineHeight: 16,
    fontFamily: fonts.body,
    fontWeight: "700",
  },
  sendTextDisabled: {
    color: colors.inkFaint,
  },

  // Expanded preview row above the field.
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    paddingHorizontal: spacing.xs,
  },
  preview: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.accent,
  },
  previewHint: {
    color: colors.inkFaint,
  },
  details: {
    minHeight: 28,
    justifyContent: "center",
    paddingHorizontal: spacing.s,
    borderRadius: radii.s,
  },
  detailsPressed: {
    backgroundColor: colors.pressed,
  },
  detailsText: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
  },
});

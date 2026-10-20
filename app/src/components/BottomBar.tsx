import * as React from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextStyle,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { colors, fonts, spacing, radius, radii } from "../theme/tokens";

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
 * Planner nav items, icon plus label, selection carried by weight
 * and color alone. Right: the capture field, a fully rounded pill,
 * kept narrow so the nav gets clear breathing space. Focusing expands
 * the composer up and out with an animated panel: the parse preview,
 * with the target pill and send controls alongside.
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

  // The expansion value drives the up-and-out panel animation.
  const [expand] = React.useState(() => new Animated.Value(0));
  const expanded = focused || text.trim() !== "";

  React.useEffect(() => {
    Animated.timing(expand, {
      toValue: expanded ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [expand, expanded]);

  const parsed = text.trim() ? parseCapture(text) : null;
  const canSend = text.trim() !== "" && !sending;

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
      {/* The panel grows upward out of the field when focused. */}
      <Animated.View
        pointerEvents={expanded ? "auto" : "none"}
        style={[
          styles.panel,
          {
            maxHeight: expand.interpolate({
              inputRange: [0, 1],
              outputRange: [0, 56],
            }),
            opacity: expand,
            transform: [
              {
                translateY: expand.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              },
            ],
          },
        ]}
      >
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
      </Animated.View>

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

        {/* The target pill rides the same expansion animation; its
            width collapses with it, so it takes no space when hidden. */}
        <Animated.View
          pointerEvents={expanded ? "auto" : "none"}
          style={[
            styles.pillWrap,
            {
              opacity: expand,
              maxWidth: expand.interpolate({
                inputRange: [0, 1],
                outputRange: [0, 96],
              }),
              transform: [
                {
                  scale: expand.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.7, 1],
                  }),
                },
              ],
            },
          ]}
        >
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
        </Animated.View>

        {/* The field: a fully rounded pill, narrowed so the nav items
            keep their breathing space on the left. */}
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
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
        {label}
      </Text>
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

  // Nav items: icon over label, no dot; weight and color carry the
  // selection.
  tab: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
    minWidth: 52,
    paddingHorizontal: spacing.xs,
    borderRadius: radius,
  },
  tabPressed: {
    backgroundColor: colors.pressed,
  },
  tabLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: "600",
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

  // Target pill, animated with the panel. Overflow hidden lets the
  // width animate away to zero.
  pillWrap: {
    justifyContent: "center",
    overflow: "hidden" as const,
  },
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

  // The capture field: a fully rounded pill, capped in width so a
  // clear gap stays between the nav and the input.
  field: {
    flex: 1,
    maxWidth: 240,
    marginLeft: "auto" as const,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    paddingLeft: spacing.m,
    paddingRight: 5,
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
    borderRadius: radius,
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

  // The expanding panel above the field.
  panel: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    overflow: "hidden",
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
    borderRadius: radius,
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

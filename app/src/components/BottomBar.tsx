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
 * and color alone. Right: a compact capture button that reads as
 * tappable. Tapping it expands, with an upward animation, into the
 * focused capture pill: the parse preview panel above, the target
 * pill inline, and the send button in the field's edge. A blur with
 * empty text collapses back to the button.
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
  const [sending, setSending] = React.useState(false);

  // Open is the user intent; mounted keeps the field on screen while
  // the collapse animation plays.
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [expand] = React.useState(() => new Animated.Value(0));
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    Animated.timing(expand, {
      toValue: open ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [expand, open]);

  React.useEffect(
    () => () => {
      if (closeTimer.current != null) {
        clearTimeout(closeTimer.current);
      }
    },
    [],
  );

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

  const openCapture = () => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setMounted(true);
    setOpen(true);
  };

  const collapse = () => {
    if (text.trim() === "") {
      setOpen(false);
      closeTimer.current = setTimeout(() => setMounted(false), 220);
    }
  };

  const closeNow = () => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setOpen(false);
    setMounted(false);
  };

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}>
      {/* The panel grows upward out of the field while open. */}
      {mounted ? (
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
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
                closeNow();
                onOpenDetails(text, targetIndex);
              }}
              accessibilityLabel="open capture details"
              accessibilityRole="button"
            >
              <Text style={styles.detailsText}>details</Text>
            </Pressable>
          ) : null}
        </Animated.View>
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

        {mounted ? (
          // The target pill rides the expansion; its width collapses
          // with it, so it takes no space when hidden.
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
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
        ) : null}

        {mounted ? (
          // The capture field: a fully rounded pill, capped in width
          // so the nav keeps its breathing space. Autofocus opens the
          // keyboard on mount.
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
            style={[
              styles.fieldWrap,
              {
                opacity: expand,
                transform: [
                  {
                    translateY: expand.interpolate({
                      inputRange: [0, 1],
                      outputRange: [8, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <View style={[styles.field, webFocusRing]}>
              <TextInput
                style={styles.input}
                placeholder="Add a task"
                placeholderTextColor={colors.inkFaint}
                value={text}
                onChangeText={setText}
                onBlur={collapse}
                onSubmitEditing={send}
                returnKeyType="send"
                multiline={false}
                autoFocus
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
                  style={[
                    styles.sendText,
                    !canSend && styles.sendTextDisabled,
                  ]}
                >
                  {"↑"}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        ) : (
          // The collapsed control: a compact button, not an empty
          // field. Tapping expands into the capture pill.
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.capturePressed,
            ]}
            onPress={() => openCapture()}
            accessibilityRole="button"
            accessibilityLabel="add task"
          >
            <Text style={styles.capturePlus}>{"+"}</Text>
            <Text style={styles.captureLabel}>Add</Text>
          </Pressable>
        )}
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

  // Collapsed capture control: an unmistakable button.
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginLeft: "auto" as const,
    minHeight: 36,
    paddingHorizontal: spacing.m,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  capturePressed: {
    backgroundColor: colors.accentDeep,
  },
  capturePlus: {
    color: colors.onAccent,
    fontSize: 16,
    lineHeight: 18,
    fontWeight: "700",
  },
  captureLabel: {
    color: colors.onAccent,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
  },

  // Target pill, animated with the panel.
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
  fieldWrap: {
    flex: 1,
    maxWidth: 240,
    marginLeft: "auto" as const,
  },
  field: {
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

import * as React from "react";
import {
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { parseCapture, type ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import {
  colors,
  fonts,
  spacing,
  radius,
  radiusFloating,
  radii,
  sheetGap,
  sheetMaxShare,
} from "../theme/tokens";

// The sheet input carries focus by caret and placeholder alone: no
// app ring, and the browser's own focus outline is suppressed on
// web so no UA ring can appear either.
const noFocusOutline = Platform.select({
  web: { outlineStyle: "none" } as unknown as TextStyle,
  default: {},
});

/**
 * The single bottom bar, shared by both tabs. Left: the Lists and
 * Planner nav items, icon plus label, selection carried by weight
 * and color alone. Right: a compact capture button. Tapping it opens
 * a floating capture sheet over the page: a scrim dims the content
 * while a rounded panel rises just above the navbar, which stays
 * visible and interactive under it. The sheet holds a multi-line
 * input, the parse line, and an action row with the target pill and
 * the save control. Tapping outside, the Add button again, or the
 * save control closes it with a downward fade. The input shows no
 * focus ring: the elevated panel is the focus, carried by the accent
 * caret and placeholder alone. There is no second capture view; the
 * panel is the whole flow.
 */
export function BottomBar({
  targets,
  defaultTargetIndex,
  onSend,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void;
}) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const [text, setText] = React.useState("");
  const [targetIndex, setTargetIndex] = React.useState(defaultTargetIndex);
  const [sending, setSending] = React.useState(false);
  // Collapsed-to-expanded input: measured content height on web, where
  // the host textarea does not grow by itself. Growth is clamped to
  // sheetMaxShare of the window; past the cap the input scrolls.
  const [inputContentHeight, setInputContentHeight] = React.useState(0);
  const maxInputHeight = Math.round(window.height * sheetMaxShare);

  // Open is the user intent; mounted keeps the sheet on screen while
  // the exit animation plays.
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [expand] = React.useState(() => new Animated.Value(0));
  const closeTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [barHeight, setBarHeight] = React.useState(64);

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

  // The growth cap clamps the input on every platform. Web adds the
  // measured height: the empty input reports its own 2-line box, which
  // is the collapsed state; long wraps push the box up to the 40% cap,
  // and the host's own overflow scrolls past it. Native multiline
  // inputs grow by themselves, so only the cap applies there.
  const inputHeightStyle =
    maxInputHeight > 0
      ? {
          maxHeight: maxInputHeight,
          height:
            Platform.OS === "web" && inputContentHeight > 0
              ? Math.min(inputContentHeight, maxInputHeight)
              : undefined,
        }
      : null;

  const send = () => {
    const capture = parsed;
    if (!capture || sending) {
      return;
    }
    setSending(true);
    onSend(capture, targets[targetIndex] ?? targets[0]);
    setText("");
    // The programmatic clear fires no content size event on web, so
    // the next open would inherit the sent draft's expanded height.
    setInputContentHeight(0);
    setSending(false);
    close();
  };

  const openCapture = () => {
    if (closeTimer.current != null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
    setMounted(true);
    setOpen(true);
  };

  const close = () => {
    setOpen(false);
    closeTimer.current = setTimeout(() => setMounted(false), 220);
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
    <View style={styles.root}>
      {/* Scrim over the content; the navbar below stays uncovered. */}
      {mounted ? (
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.scrim,
            {
              bottom: barHeight,
              height: Math.max(window.height - barHeight, 0),
              opacity: expand,
            },
          ]}
        >
          <Pressable
            style={styles.scrimFill}
            onPress={close}
            accessibilityLabel="close capture"
            accessibilityRole="button"
          />
        </Animated.View>
      ) : null}

      {/* The floating sheet, just above the navbar. */}
      {mounted ? (
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.sheet,
            {
              bottom: barHeight + spacing.s,
              opacity: expand,
              transform: [
                {
                  translateY: expand.interpolate({
                    inputRange: [0, 1],
                    outputRange: [16, 0],
                  }),
                },
                {
                  scale: expand.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.96, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <TextInput
            style={[styles.sheetInput, inputHeightStyle]}
            placeholder="Add a task"
            placeholderTextColor={colors.inkFaint}
            value={text}
            onChangeText={setText}
            onContentSizeChange={(event) => {
              if (Platform.OS === "web") {
                setInputContentHeight(event.nativeEvent.contentSize.height);
              }
            }}
            onSubmitEditing={send}
            returnKeyType="send"
            multiline
            autoFocus
            selectionColor={colors.accent}
          />
          {/* Parse feedback only when something parsed; the panel
              stays as clean as possible otherwise. */}
          {parsed && parsed.matches != null && parsed.matches.length > 0 ? (
            <Text style={styles.sheetParse} numberOfLines={1}>
              {`parsed: ${parsed.matches.map((m) => m.text).join(", ")} -> ${parsed.name}`}
            </Text>
          ) : null}
          <View style={styles.sheetActions}>
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
            <View style={styles.sheetSpacer} />
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
                Add
              </Text>
            </Pressable>
          </View>
        </Animated.View>
      ) : null}

      {/* The navbar: measured so the sheet anchors to its top. */}
      <View
        style={[styles.bar, { paddingBottom: insets.bottom + 8 }]}
        onLayout={(event) => setBarHeight(event.nativeEvent.layout.height)}
      >
        <View style={styles.row}>
          <IconTab
            label="Lists"
            active={pathname === "/"}
            onPress={() => {
              closeNow();
              router.navigate("/");
            }}
            icon={<ListGlyph active={pathname === "/"} />}
          />
          <IconTab
            label="Planner"
            active={pathname === "/planner"}
            onPress={() => {
              closeNow();
              router.navigate("/planner");
            }}
            icon={<CalendarGlyph active={pathname === "/planner"} />}
          />
          {/* The air between the nav and the capture control. */}
          <View style={styles.navSpacer} />
          <Pressable
            style={({ pressed }) => [
              styles.captureButton,
              pressed && styles.capturePressed,
            ]}
            onPress={() => (open ? close() : openCapture())}
            accessibilityRole="button"
            accessibilityLabel="add task"
          >
            <View style={styles.capturePlus}>
              <View style={styles.capturePlusH} />
              <View style={styles.capturePlusV} />
            </View>
            <Text style={styles.captureLabel}>Add</Text>
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
  root: {},
  bar: {
    backgroundColor: colors.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  navSpacer: {
    flex: 1,
    minWidth: spacing.xl,
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

  // Collapsed capture control: an unmistakable button, glyph and
  // label optically centered on one line.
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    minHeight: 36,
    paddingHorizontal: spacing.m,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  capturePressed: {
    backgroundColor: colors.accentDeep,
  },
  capturePlus: {
    width: 14,
    height: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  capturePlusH: {
    width: 12,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.onAccent,
  },
  capturePlusV: {
    position: "absolute" as const,
    left: 6,
    top: 1,
    width: 2,
    height: 12,
    borderRadius: 1,
    backgroundColor: colors.onAccent,
  },
  captureLabel: {
    color: colors.onAccent,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
  },

  // Scrim: covers the content above the navbar only.
  scrim: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    backgroundColor: colors.scrim,
  },
  scrimFill: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },

  // The floating capture sheet.
  sheet: {
    position: "absolute" as const,
    left: spacing.m,
    right: spacing.m,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    padding: spacing.m,
    gap: sheetGap,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  sheetInput: {
    fontSize: 15,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    minHeight: 40,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.s,
    ...noFocusOutline,
  },
  sheetParse: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  sheetActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  sheetSpacer: {
    flex: 1,
  },

  // Target list pill, inside the sheet's action row.
  pill: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    backgroundColor: colors.accentSoft,
    borderRadius: radii.pill,
    paddingHorizontal: spacing.m,
    minHeight: 32,
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

  // The save control: a solid accent button at the row's right edge.
  send: {
    backgroundColor: colors.accent,
    borderRadius: radius,
    paddingHorizontal: spacing.l,
    minHeight: 32,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },  sendPressed: {
    backgroundColor: colors.accentDeep,
  },
  sendDisabled: {
    backgroundColor: colors.pressed,
  },
  sendText: {
    color: colors.onAccent,
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
  },
  sendTextDisabled: {
    color: colors.inkFaint,
  },
});

import * as React from "react";
import {
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  useWindowDimensions,
  type TextStyle,
  type ViewProps,
} from "react-native";
import { useKeyboardState, useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDismiss } from "@/hooks/use-dismiss";
import { useProgress } from "@/lib/motion/progress";
import { motion } from "@/lib/motion/tokens";
import {
  measure,
  radius,
  radiusFloating,
  shadows,
  spacing,
  touchTarget,
  type,
  type Palette,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { PaneGrab, PaneRise } from "@/components/motion/pane-rise";
import { MotionScrollView, type MotionScrollRef } from "@/components/motion/scroll-view";
import { Overlay } from "./overlay-host";
import { Pressable } from "./pressable";
import { useOpenerFocus } from "./use-opener-focus";

/** One row of the pane. The caller owns what a press does. */
export type CommandRow = {
  id: string;
  label: string;
  /** A quiet second word on the row, such as "Settings". */
  hint?: string;
  /** Extra words the search matches, without showing them. */
  keywords?: string[];
  onPress: () => void;
};

/**
 * A command palette that rises from the bottom edge, where the thumb
 * and the bar's opener are. The search sits at the bottom of the panel
 * and the rows read up from it, so the first row lands nearest the
 * search. The scrim, the panel and the search are modal: the screen
 * behind is inert and focus moves into the search on open and back to
 * the opener on close. Escape, Android back, a press outside, a
 * downward drag on the title row or the Close button shuts it.
 *
 * The panel rides the keyboard on the lift a sheet uses, and holds
 * below the status bar, so the search stays above the keys.
 *
 * The caller owns the rows, the recent order and what each row does.
 * The pane filters by label, hint and keyword, draws at most `limit`
 * rows, and keeps the search at the bottom while the rows scroll.
 */
export function CommandPane({
  open,
  onClose,
  label,
  placeholder = "Search commands",
  emptyLabel = "No commands",
  commands,
  limit = 12,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the pane for assistive tech. */
  label: string;
  placeholder?: string;
  emptyLabel?: string;
  commands: CommandRow[];
  limit?: number;
}) {
  const { styles, colors } = useThemedStyles(makeStyles);
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const keyboard = useReanimatedKeyboardAnimation();
  const keyboardHeight = useKeyboardState((state) => state.height);
  const list = React.useRef<MotionScrollRef>(null);
  const [query, setQuery] = React.useState("");
  const [focused, setFocused] = React.useState(false);
  // The pane stays in the tree while its spring plays out.
  const [present, setPresent] = React.useState(open);
  if (open && !present) {
    setPresent(true);
  }
  const [wasOpen, setWasOpen] = React.useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (open) {
      setQuery("");
    }
  }

  useOpenerFocus(open);
  useDismiss(open, onClose);
  const progress = useProgress(open, {
    spring: motion.spring.pane,
    onSettled: (at) => {
      if (at === 0) {
        setPresent(false);
      }
    },
  });

  const scrim = useAnimatedStyle(() => ({ opacity: progress.value }));
  // The keyboard library reports the whole IME inset, the system
  // navigation included. The dock already holds the panel above that
  // bar, so the lift carries only the part of the keyboard above it.
  const lift = useAnimatedStyle(
    () => ({
      transform: [
        { translateY: Math.min(keyboard.height.value + insets.bottom, 0) },
      ],
    }),
    [insets.bottom],
  );

  // The room the panel may take, from the keyboard's top to the status
  // bar. It holds through the exit, so the panel keeps one box while it
  // slides away.
  const room = Math.max(
    220,
    Math.min(
      window.height * 0.72,
      window.height - keyboardHeight - insets.top - spacing.s,
    ),
  );
  const [cap, setCap] = React.useState(room);
  if (open && cap !== room) {
    setCap(room);
  }

  // The rows read up from the search, so the last row in the tree sits
  // nearest it. A list longer than the room rests at its end, and the
  // cap moves under the keyboard, so every change of the box goes back
  // to the end.
  const toEnd = React.useCallback(() => {
    list.current?.scrollToEnd({ animated: false });
  }, []);

  if (!present) {
    return null;
  }

  const needle = query.trim().toLowerCase();
  const rows = commands
    .filter((row) => {
      if (needle === "") {
        return true;
      }
      return [row.label, row.hint ?? "", ...(row.keywords ?? [])]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    })
    .slice(0, limit)
    .reverse();

  return (
    <>
      <Overlay layer="sheetScrim" modal={open}>
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[styles.scrim, scrim]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="dismiss commands"
          />
        </Animated.View>
      </Overlay>
      <Overlay layer="sheet">
        {/* The lift carries the keyboard, the dock holds the panel to
            the bottom edge, and the rise carries the clock and the
            finger, so the two drivers never meet in one style. */}
        <Animated.View
          testID="command-lift"
          pointerEvents="box-none"
          style={[styles.lift, { height: window.height }, lift]}
        >
          <View
            testID="command-dock"
            pointerEvents="box-none"
            style={[styles.dock, { bottom: spacing.s + insets.bottom }]}
          >
            <PaneRise open={open} progress={progress} onDismiss={onClose}>
              <View
                role="dialog"
                aria-modal
                aria-label={label}
                tabIndex={-1}
                pointerEvents={open ? "auto" : "none"}
                style={[styles.panel, { maxHeight: cap }]}
              >
                <PaneGrab>
                  <View testID="command-grab" style={styles.head}>
                    <View style={styles.grab} {...hiddenProps}>
                      <View style={styles.grabBar} />
                    </View>
                    <View style={styles.titleRow}>
                      <Text style={styles.title}>{label}</Text>
                      <Pressable
                        onPress={onClose}
                        accessibilityRole="button"
                        accessibilityLabel="close commands"
                        style={({ pressed }) => [
                          styles.close,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={styles.closeLabel}>Close</Text>
                      </Pressable>
                    </View>
                  </View>
                </PaneGrab>
                <MotionScrollView
                  ref={list}
                  keyboardShouldPersistTaps="handled"
                  style={styles.list}
                  contentContainerStyle={styles.rows}
                  onContentSizeChange={toEnd}
                  onLayout={toEnd}
                >
                  {rows.map((row, index) => (
                    <Pressable
                      key={row.id}
                      testID={`command:${row.id}`}
                      onPress={row.onPress}
                      role="button"
                      accessibilityLabel={
                        row.hint == null ? row.label : `${row.label} ${row.hint}`
                      }
                      style={({ pressed }) => [
                        styles.row,
                        index > 0 && styles.divider,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.rowLabel} numberOfLines={1}>
                        {row.label}
                      </Text>
                      {row.hint != null ? (
                        <Text style={styles.hint} numberOfLines={1}>
                          {` ${row.hint}`}
                        </Text>
                      ) : null}
                    </Pressable>
                  ))}
                  {rows.length === 0 ? (
                    <Text style={styles.empty}>{emptyLabel}</Text>
                  ) : null}
                </MotionScrollView>
                <TextInput
                  autoFocus
                  value={query}
                  onChangeText={setQuery}
                  placeholder={placeholder}
                  placeholderTextColor={colors.inkFaint}
                  selectionColor={colors.accent}
                  aria-label={placeholder}
                  role="searchbox"
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onFocus={() => setFocused(true)}
                  onBlur={() => setFocused(false)}
                  style={[styles.search, focused && styles.searchFocused]}
                  testID="command-search"
                />
              </View>
            </PaneRise>
          </View>
        </Animated.View>
      </Overlay>
    </>
  );
}

/** The drag cue. It has no words and no job, so assistive tech skips
    it. */
const hiddenProps: ViewProps = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  "aria-hidden": true,
};

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    scrim: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: colors.scrim,
    },
    lift: {
      position: "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      // A pane that starts under the window must not add page scroll.
      // A browser grows the document to hold it and then scrolls the
      // focused search into view, which lifts the whole app. `hidden`
      // still lets a focus scroll the box, so the edge clips instead.
      ...Platform.select({
        web: { overflow: "clip" as "hidden" },
      }),
    },
    // The dock centers the panel, which holds to the reading measure
    // (ADR 0010).
    dock: {
      position: "absolute",
      left: 0,
      right: 0,
      paddingHorizontal: spacing.m,
      alignItems: "center",
    },
    panel: {
      width: "100%",
      maxWidth: measure,
      backgroundColor: colors.surface,
      borderRadius: radiusFloating,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      gap: spacing.s,
      ...shadows.floating,
    },
    head: {
      gap: spacing.xs,
    },
    grab: {
      alignSelf: "center",
      paddingVertical: spacing.xs,
    },
    grabBar: {
      width: 32,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.inkFaint,
    },
    titleRow: {
      minHeight: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingLeft: spacing.xs,
    },
    title: {
      ...type.eyebrow,
      flex: 1,
      color: colors.inkMuted,
    },
    close: {
      minHeight: touchTarget,
      minWidth: touchTarget,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: spacing.s,
      borderRadius: radius,
    },
    closeLabel: {
      ...type.control,
      color: colors.inkMuted,
    },
    search: {
      minHeight: touchTarget,
      paddingHorizontal: spacing.m,
      paddingVertical: spacing.s,
      borderRadius: radius,
      borderWidth: 1,
      borderColor: colors.hairline,
      backgroundColor: colors.paper,
      ...type.body,
      color: colors.ink,
      // The caret and the accent edge carry focus, not a UA ring.
      ...Platform.select({
        web: { outlineStyle: "none" } as unknown as TextStyle,
        default: {},
      }),
    },
    searchFocused: {
      borderColor: colors.accent,
    },
    list: {
      flexGrow: 0,
      flexShrink: 1,
    },
    rows: {
      // A short list hugs the search instead of floating at the top of
      // the room the cap leaves.
      flexGrow: 1,
      justifyContent: "flex-end",
      paddingBottom: spacing.xs,
    },
    row: {
      minHeight: touchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.s,
      paddingHorizontal: spacing.s,
      borderRadius: radius,
    },
    divider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.hairline,
      borderTopLeftRadius: 0,
      borderTopRightRadius: 0,
    },
    pressed: {
      backgroundColor: colors.pressed,
    },
    rowLabel: {
      ...type.control,
      flex: 1,
      color: colors.ink,
    },
    hint: {
      ...type.caption,
      maxWidth: "45%",
      color: colors.inkMuted,
    },
    empty: {
      ...type.meta,
      color: colors.inkMuted,
      paddingHorizontal: spacing.s,
      paddingVertical: spacing.m,
    },
  }),
});

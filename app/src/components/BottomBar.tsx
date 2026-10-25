import * as React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import type { ParsedCapture } from "../features/capture/parse";
import type { CaptureTarget } from "../features/capture/write";
import { CaptureSheet } from "../features/capture/components/CaptureSheet";
import { useCaptureDraft } from "../features/capture/hooks/useCaptureDraft";
import {
  bottomBar,
  colors,
  fonts,
  spacing,
  radius,
  radiusFloating,
  radii,
  touchTarget,
} from "../theme/tokens";

/**
 * The single bottom bar, shared by both tabs. Left: the Lists and
 * Planner nav items, icon plus label, selection carried by weight
 * and color alone. Right: a compact capture button. Tapping it opens
 * the floating capture sheet over the page, while the bar slides
 * away under it. The bar owns the open state and one animation clock
 * for both, so the sheet and the navbar move as a single motion; the
 * sheet itself is CaptureSheet, fed by the draft hook.
 *
 * Saving leaves in one motion: the input drops focus and the sheet
 * starts its exit on the same frame, the dock riding the keyboard's
 * own height as it goes, and the note is written behind all of it. A
 * failed write is reported in a toast above the navbar, which keeps
 * the draft and offers to run it again; the sheet itself never
 * reopens for an error.
 */
export function BottomBar({
  targets,
  defaultTargetIndex,
  onSend,
}: {
  targets: CaptureTarget[];
  defaultTargetIndex: number;
  onSend: (parsed: ParsedCapture, target: CaptureTarget) => void | Promise<void>;
}) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();

  // The failure the user has not dismissed, or null. The message and
  // the draft itself live in the capture hook; this only carries the
  // toast, so Retry repeats the draft the hook still holds.
  const [failure, setFailure] = React.useState<{
    dismissed: boolean;
  } | null>(null);

  // The write behind a send, run after the sheet is already on its way
  // out. A failure raises the toast and keeps the draft for Retry; a
  // success clears the toast.
  const write = React.useCallback(
    async (parsed: ParsedCapture, target: CaptureTarget) => {
      try {
        await onSend(parsed, target);
        setFailure(null);
      } catch (error) {
        setFailure({ dismissed: false });
        throw error;
      }
    },
    [onSend],
  );

  // Open is the user intent; mounted keeps the sheet on screen while
  // the exit animation plays.
  const [open, setOpen] = React.useState(false);
  const [mounted, setMounted] = React.useState(false);
  const [expand] = React.useState(() => new Animated.Value(0));
  // The navbar's lift: 1 visible, 0 slid away while capture is open.
  const [barLift] = React.useState(() => new Animated.Value(1));
  // The row's height, measured where the collapse clip cannot reach it.
  const [rowHeight, setRowHeight] = React.useState(36);
  // The navbar's height: its row plus its own padding. It is computed
  // rather than measured, because the collapse clip clamps the height
  // it would measure, and the bar would lose its bottom padding.
  const barHeight =
    rowHeight + spacing.s + insets.bottom + spacing.s;

  // The dock's distance from the bottom of the window. Closed, it sits
  // above the navbar; open, just above the keyboard. One node for the
  // whole session: the sheet re-renders on every keystroke, and a
  // fresh node each time would attach and detach listeners while the
  // user types.
  const dockBottom = React.useMemo(
    () =>
      expand.interpolate({
        inputRange: [0, 1],
        outputRange: [barHeight + spacing.s + insets.bottom, spacing.s],
      }),
    [expand, barHeight, insets.bottom],
  );

  React.useEffect(() => {
    // One clock for the sheet's travel and the navbar's collapse: both
    // start and finish on the same frame, so the close reads as a
    // single motion.
    const animation = Animated.parallel([
      Animated.timing(expand, {
        toValue: open ? 1 : 0,
        duration: 220,
        useNativeDriver: false,
      }),
      Animated.timing(barLift, {
        toValue: open ? 0 : 1,
        duration: 220,
        useNativeDriver: false,
      }),
    ]);
    animation.start(({ finished }) => {
      // The sheet leaves the tree when its exit has played, not on a
      // timer: the closing frame keeps the input's height, and a
      // reopened sheet cancels the unmount.
      if (finished && !open) {
        setMounted(false);
      }
    });
    return () => animation.stop();
  }, [barLift, expand, open]);

  // The draft and its send lifecycle: the text, the target pill, the
  // parse and the write behind a send all live in the hook, so the
  // sheet only renders them and the bar only owns the open state.
  const draft = useCaptureDraft({
    targets,
    defaultTargetIndex,
    onSend: write,
  });

  const openCapture = () => {
    setFailure(null);
    // The sent draft is cleared here, not on send, so the closing frame
    // keeps the input's height and the sheet never jumps as it leaves.
    draft.reset();
    setMounted(true);
    setOpen(true);
  };

  const retry = () => {
    if (draft.sending) {
      return;
    }
    // The hook still holds the draft that failed, so a retry repeats
    // what the user sent rather than what the input holds by now.
    draft.send();
  };

  const dismiss = () => {
    setFailure((current) => (current == null ? null : { dismissed: true }));
  };

  const toastMessage =
    failure != null && !failure.dismissed ? draft.error : null;

  const close = () => {
    setOpen(false);
  };

  const closeNow = () => {
    setOpen(false);
    setMounted(false);
  };

  return (
    <View style={styles.root}>
      {/* The capture sheet: the scrim over the content, the dock riding
          the keyboard, and the panel. It stays mounted while the exit
          plays, and the scrim follows the navbar's collapse. */}
      {mounted ? (
        <CaptureSheet
          open={open}
          onClose={close}
          draft={draft}
          bottom={dockBottom}
          scrim={{
            bottom: barLift.interpolate({
              inputRange: [0, 1],
              outputRange: [0, barHeight],
            }),
            // The full window: the bottom offset alone clears the
            // bar, so the scrim reaches the status strip.
            height: window.height,
          }}
          progress={expand}
        />
      ) : null}

      {/* The navbar: slides away while capture is open, and returns
          on close. The inner view carries the natural height measure
          so the collapse target stays stable. */}
      <Animated.View
        style={[
          styles.barClip,
          {
            maxHeight: barLift.interpolate({
              inputRange: [0, 1],
              outputRange: [0, barHeight],
            }),
            opacity: barLift,
          },
        ]}
      >
        <View
          style={[styles.bar, { paddingBottom: insets.bottom + spacing.s }]}
        >
        {/* The system navigation bar draws over this strip. A dark band
            under it keeps the light system buttons visible on a phone
            that uses three buttons rather than gestures. */}
        {insets.bottom > 0 ? (
          <View
            pointerEvents="none"
            style={[styles.navBand, { height: insets.bottom }]}
          />
        ) : null}
        <View
          style={styles.row}
          onLayout={(event) => {
            const height = event.nativeEvent.layout.height;
            if (height > 0) {
              setRowHeight(height);
            }
          }}
        >
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
      </Animated.View>

      {/* A failed write reports here, above the navbar, with the draft
          kept for Retry. The sheet stays closed: the toast takes its
          place instead of reopening it, and opening the sheet again
          clears the toast. */}
      {toastMessage != null ? (
        <View style={[styles.toast, { bottom: barHeight + spacing.s }]}>
          <Text style={styles.toastMessage} numberOfLines={3}>
            {toastMessage}
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.toastAction,
              pressed && styles.toastActionPressed,
            ]}
            onPress={retry}
            accessibilityRole="button"
            accessibilityLabel="retry capture"
          >
            <Text style={styles.toastActionText}>Retry</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.toastAction,
              pressed && styles.toastActionPressed,
            ]}
            onPress={dismiss}
            accessibilityRole="button"
            accessibilityLabel="dismiss capture failure"
          >
            <Text style={styles.toastDismissText}>Dismiss</Text>
          </Pressable>
        </View>
      ) : null}
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

/** Simple glyphs built from hairline views; no icon font. */
function ListGlyph({ active }: { active: boolean }) {
  const color = active ? colors.accent : colors.inkMuted;
  return (
    <View style={styles.glyphList}>
      <View
        style={[
          styles.glyphLine,
          { backgroundColor: color, width: bottomBar.glyph },
        ]}
      />
      <View
        style={[
          styles.glyphLine,
          { backgroundColor: color, width: bottomBar.glyph - 6 },
        ]}
      />
      <View
        style={[
          styles.glyphLine,
          { backgroundColor: color, width: bottomBar.glyph },
        ]}
      />
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
  // The navbar's collapse wrapper: the bar slides away under this
  // clip while capture is open.
  barClip: {
    overflow: "hidden" as const,
  },
  navBand: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.accentDeep,
  },
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
    minHeight: bottomBar.row,
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
    minHeight: touchTarget,
    minWidth: bottomBar.tabWidth,
    paddingHorizontal: spacing.xs,
    borderRadius: radius,
  },
  tabPressed: {
    backgroundColor: colors.pressed,
  },
  tabLabel: {
    fontSize: bottomBar.labelSize,
    lineHeight: bottomBar.labelLine,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    marginTop: 3,
  },
  tabLabelActive: {
    color: colors.accent,
    fontWeight: "600",
  },
  glyphList: {
    height: 16,
    alignItems: "flex-start",
    gap: 4,
  },
  glyphLine: {
    height: 2.5,
    borderRadius: 1.25,
  },
  glyphCalendar: {
    width: bottomBar.glyph,
    height: bottomBar.glyph,
    borderWidth: 1.5,
    borderRadius: 5,
    overflow: "hidden",
  },
  glyphCalendarTop: {
    height: 5,
    width: "100%" as const,
  },
  glyphCalendarDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 4,
    marginTop: 3.5,
  },

  // Collapsed capture control: an unmistakable button, glyph and
  // label optically centered on one line.
  captureButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: bottomBar.add,
    paddingHorizontal: spacing.l,
    borderRadius: radii.pill,
    backgroundColor: colors.accent,
  },
  capturePressed: {
    backgroundColor: colors.accentDeep,
  },
  capturePlus: {
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  capturePlusH: {
    width: 16,
    height: 2.5,
    borderRadius: 1.25,
    backgroundColor: colors.onAccent,
  },
  capturePlusV: {
    position: "absolute" as const,
    left: 7.75,
    top: 1,
    width: 2.5,
    height: 16,
    borderRadius: 1.25,
    backgroundColor: colors.onAccent,
  },
  captureLabel: {
    color: colors.onAccent,
    fontSize: bottomBar.addLabelSize,
    lineHeight: bottomBar.addLabelLine,
    fontFamily: fonts.body,
    fontWeight: "600",
  },

  // The failure toast: a floating surface above the navbar, in the
  // sheet's own language, carrying the reason and the two actions.
  toast: {
    position: "absolute" as const,
    left: spacing.m,
    right: spacing.m,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: spacing.s,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  toastMessage: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.danger,
  },
  toastAction: {
    minHeight: touchTarget,
    minWidth: touchTarget,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: spacing.s,
    borderRadius: radius,
  },
  toastActionPressed: {
    backgroundColor: colors.pressed,
  },
  toastActionText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  toastDismissText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
});

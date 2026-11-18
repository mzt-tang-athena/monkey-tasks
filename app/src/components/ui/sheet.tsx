import * as React from "react";
import {
  Platform,
  StyleSheet,
  View,
  useWindowDimensions,
  type ViewProps,
} from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
import { SheetDrag, SheetGrab } from "@/components/motion/sheet-drag";
import { useDismiss } from "@/hooks/use-dismiss";
import type { Progress } from "@/lib/motion/progress";
import { measure, radiusFloating, shadows, sheetGap, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { Overlay } from "./overlay-host";
import { Pressable } from "./pressable";
import { useOpenerFocus } from "./use-opener-focus";

/**
 * A floating sheet: a scrim over the page, a dock that rides the
 * keyboard, and the panel with the caller's content. A press on the
 * scrim, Android back and a downward drag on the handle close it. A
 * caller wraps its header row in `SheetGrab` to make it a handle too.
 * While the sheet shows, the screen under it is hidden from assistive
 * tech.
 *
 * The caller owns the clock. It passes a `Progress`, which drives the
 * scrim, the panel and the bar. With `rideKeyboard`, the dock follows
 * the keyboard's height and progress on the UI thread, so the sheet
 * never drifts against the keyboard.
 */
export function Sheet({
  open,
  onDismiss,
  label,
  closeLabel = "close sheet",
  progress,
  rideKeyboard = false,
  scrim = false,
  stacked = false,
  covered = false,
  children,
}: {
  open: boolean;
  onDismiss: () => void;
  /** Names the sheet for assistive tech. */
  label: string;
  /** The name of the scrim's close button. */
  closeLabel?: string;
  /** 0 closed to 1 open, from the caller's clock. */
  progress: Progress;
  /** The dock follows the soft keyboard on the UI thread. */
  rideKeyboard?: boolean;
  /** Draws the scrim. The page is hidden from assistive tech either way. */
  scrim?: boolean;
  /**
   * The sheet opens over another sheet. Its scrim then draws in the
   * sheet layer, above the sheet under it, which it dims and blocks.
   */
  stacked?: boolean;
  /**
   * A stacked sheet covers this one. The panel takes no focus and no
   * press, and assistive tech skips it, until the cover goes.
   */
  covered?: boolean;
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  useDismiss(open, onDismiss);
  useOpenerFocus(open);

  const window = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();
  const insets = useSafeAreaInsets();

  // The keyboard's own progress leads while it moves. The caller's
  // clock drives the sheet when no keyboard moves, as in the browser.
  const travel = useDerivedValue(
    () =>
      rideKeyboard
        ? Math.max(progress.value, keyboard.progress.value)
        : progress.value,
    [rideKeyboard],
  );

  const fade = useAnimatedStyle(() => ({ opacity: travel.value }));
  const panel = useAnimatedStyle(() => ({
    opacity: travel.value,
    transform: [
      { translateY: 16 * (1 - travel.value) },
      { scale: 0.96 + 0.04 * travel.value },
    ],
  }));
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: rideKeyboard ? keyboard.height.value : 0 }],
  }));

  // On the web a parent's `pointer-events: none` does not stop a Text
  // child, which React Native Web gives `pointer-events: auto`. The
  // closing panel must let the bar take the press, as it does natively,
  // so the whole panel is inert while it closes.
  const panelRef = React.useRef<React.ComponentRef<typeof Animated.View>>(null);
  React.useLayoutEffect(() => {
    if (Platform.OS !== "web") {
      return;
    }
    const node = panelRef.current as unknown as HTMLElement | null;
    if (node != null) {
      node.inert = !open || covered;
    }
  }, [open, covered]);

  return (
    <>
      <Overlay layer={stacked ? "sheet" : "sheetScrim"} modal={open}>
        {scrim ? (
          <Animated.View
            pointerEvents={open ? "auto" : "none"}
            style={[styles.scrim, { height: window.height }, fade]}
          >
            <Pressable
              style={StyleSheet.absoluteFill}
              onPress={onDismiss}
              accessibilityRole="button"
              accessibilityLabel={closeLabel}
            />
          </Animated.View>
        ) : null}
      </Overlay>
      <Overlay layer="sheet">
        {/* The lift carries the keyboard and the dock carries the
            placement, so the two drivers never meet in one style. */}
        <Animated.View
          pointerEvents="box-none"
          style={[styles.lift, { height: window.height }, lift]}
        >
          {/* The inset and the keyboard lift add. The keyboard library
              reports its height above the system navigation. */}
          <Animated.View
            testID="sheet-dock"
            pointerEvents="box-none"
            style={[styles.dock, { bottom: spacing.s + insets.bottom }]}
          >
            <SheetDrag open={open} onDismiss={onDismiss}>
              <Animated.View
                ref={panelRef}
                role="dialog"
                aria-modal
                aria-label={label}
                tabIndex={-1}
                pointerEvents={open && !covered ? "auto" : "none"}
                style={[styles.panel, panel]}
                {...(covered ? coveredProps : null)}
              >
                <PanelFocus open={open} />
                {children}
                {/* The handle sits in the panel's top padding, so it
                    adds no height. It is a cue for the drag, which the
                    scrim and back already offer, so assistive tech
                    skips it. */}
                <SheetGrab>
                  <View testID="sheet-handle" style={styles.handle} {...hiddenProps}>
                    <View style={styles.handleBar} />
                  </View>
                </SheetGrab>
              </Animated.View>
            </SheetDrag>
          </Animated.View>
        </Animated.View>
      </Overlay>
    </>
  );
}

/** Hides a covered panel from assistive tech on a phone. The web uses
    `inert`, set in the layout effect. */
const coveredProps: ViewProps = Platform.select<ViewProps>({
  web: {},
  android: { importantForAccessibility: "no-hide-descendants" },
  default: { accessibilityElementsHidden: true },
});

/** Hides a decoration from assistive tech on every platform. */
const hiddenProps: ViewProps = {
  accessibilityElementsHidden: true,
  importantForAccessibility: "no-hide-descendants",
  "aria-hidden": true,
};

/** Moves focus to the first control in the panel, or the panel itself.
    It lives inside the panel, so it mounts with the overlay's portal.
    It sits out of the flow, so the panel's gap never counts it. */
function PanelFocus({ open }: { open: boolean }) {
  const ref = React.useRef<React.ComponentRef<typeof View>>(null);
  React.useEffect(() => {
    if (!open || Platform.OS !== "web") {
      return;
    }
    const node = ref.current as unknown as HTMLElement | null;
    const dialog = node?.closest<HTMLElement>('[role="dialog"]');
    if (dialog == null) {
      return;
    }
    const first = dialog.querySelector<HTMLElement>(
      'input, textarea, button, [tabindex]:not([tabindex="-1"])',
    );
    (first ?? dialog).focus();
  }, [open]);
  return <View ref={ref} style={focusMark.outOfFlow} />;
}

const focusMark = StyleSheet.create({
  outOfFlow: {
    position: "absolute",
  },
});

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
    scrim: {
      position: "absolute",
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
    },
    // The dock spans the window and centers the panel, which holds to
    // the reading measure (ADR 0010).
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
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: colors.hairline,
      borderRadius: radiusFloating,
      overflow: "hidden",
      padding: spacing.m,
      gap: sheetGap,
      ...shadows.floating,
    },
    handle: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: spacing.m,
      alignItems: "center",
      justifyContent: "center",
    },
    handleBar: {
      width: 32,
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.inkFaint,
    },
  }),
});

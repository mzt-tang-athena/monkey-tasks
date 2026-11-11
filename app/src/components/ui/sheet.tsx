import * as React from "react";
import { Platform, StyleSheet, View, useWindowDimensions } from "react-native";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
} from "react-native-reanimated";
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
 * scrim and Android back close it. While it shows, the screen under it
 * is hidden from assistive tech.
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
  children: React.ReactNode;
}) {
  const { styles } = useThemedStyles(makeStyles);
  useDismiss(open, onDismiss);
  useOpenerFocus(open);

  const window = useWindowDimensions();
  const keyboard = useReanimatedKeyboardAnimation();

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
      node.inert = !open;
    }
  }, [open]);

  return (
    <>
      <Overlay layer="sheetScrim" modal={open}>
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
          <Animated.View pointerEvents="box-none" style={styles.dock}>
            <Animated.View
              ref={panelRef}
              role="dialog"
              aria-modal
              aria-label={label}
              tabIndex={-1}
              pointerEvents={open ? "auto" : "none"}
              style={[styles.panel, panel]}
            >
              <PanelFocus open={open} />
              {children}
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Overlay>
    </>
  );
}

/** Moves focus to the first control in the panel, or the panel itself.
    It lives inside the panel, so it mounts with the overlay's portal. */
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
  return <View ref={ref} />;
}

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
      bottom: spacing.s,
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
      padding: spacing.m,
      gap: sheetGap,
      ...shadows.floating,
    },
  }),
});

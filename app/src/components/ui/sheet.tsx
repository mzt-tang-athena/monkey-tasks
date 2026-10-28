import * as React from "react";
import {
  Animated,
  Pressable,
  StyleSheet,
  useWindowDimensions,
} from "react-native";
import { useKeyboardAnimation } from "react-native-keyboard-controller";
import { useDismiss } from "@/hooks/use-dismiss";
import { useSheetMotion } from "@/lib/motion";
import {
  colors,
  radiusFloating,
  shadows,
  sheetGap,
  spacing,
} from "@/theme/tokens";
import { Overlay } from "./overlay-host";

/** A distance the platform or the sheet's own clock can drive. */
export type AnimatedLength =
  | number
  | Animated.Value
  | Animated.AnimatedInterpolation<number>;

/**
 * A floating sheet: a scrim over the page, a dock that rides the
 * keyboard, and the panel with the caller's content. A press on the
 * scrim and Android back close it. While it shows, the screen under
 * it is hidden from assistive tech.
 *
 * The sheet runs its own clock and stays on screen until its exit has
 * played. A caller that moves something else with the sheet, as the
 * bottom bar does, passes its own `progress` and mounts the sheet for
 * as long as that clock runs.
 */
export function Sheet({
  open,
  onClose,
  label,
  closeLabel = "close sheet",
  progress,
  bottom = spacing.s,
  scrim,
  children,
}: {
  open: boolean;
  onClose: () => void;
  /** Names the sheet for assistive tech. */
  label: string;
  /** The name of the scrim's close button. */
  closeLabel?: string;
  /** 0 closed to 1 open, from the caller's clock. */
  progress?: Animated.Value;
  /** The dock's distance from the bottom of the window. */
  bottom?: AnimatedLength;
  /** Where the scrim ends, when it must leave a bar uncovered. */
  scrim?: { bottom: AnimatedLength; height: number };
  children: React.ReactNode;
}) {
  const own = progress == null;
  const [mounted, setMounted] = React.useState(open);
  if (open && !mounted) {
    setMounted(true);
  }
  const clock = useSheetMotion(open, () => setMounted(false));
  const travel = progress ?? clock;

  useDismiss(open, onClose);

  if (own && !mounted && !open) {
    return null;
  }
  return (
    <SheetLayers
      open={open}
      onClose={onClose}
      label={label}
      closeLabel={closeLabel}
      travel={travel}
      bottom={bottom}
      scrim={scrim}
    >
      {children}
    </SheetLayers>
  );
}

function SheetLayers({
  open,
  onClose,
  label,
  closeLabel,
  travel,
  bottom,
  scrim,
  children,
}: {
  open: boolean;
  onClose: () => void;
  label: string;
  closeLabel: string;
  travel: Animated.Value;
  bottom: AnimatedLength;
  scrim?: { bottom: AnimatedLength; height: number };
  children: React.ReactNode;
}) {
  const window = useWindowDimensions();
  // The keyboard's height as a node the platform moves frame by frame,
  // so the dock and the keyboard travel together. Android runs edge to
  // edge and never resizes the window for the keyboard.
  const { height: keyboardHeight } = useKeyboardAnimation();

  return (
    <>
      <Overlay layer="sheetScrim" modal>
        <Animated.View
          pointerEvents={open ? "auto" : "none"}
          style={[
            styles.scrim,
            {
              bottom: scrim?.bottom ?? 0,
              height: scrim?.height ?? window.height,
              opacity: travel,
            },
          ]}
        >
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={closeLabel}
          />
        </Animated.View>
      </Overlay>
      <Overlay layer="sheet">
        {/* The lift carries the keyboard and the dock carries the
            placement, so the two drivers never meet in one style. */}
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.lift,
            {
              height: window.height,
              transform: [{ translateY: keyboardHeight }],
            },
          ]}
        >
          <Animated.View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
            <Animated.View
              role="dialog"
              aria-modal
              aria-label={label}
              pointerEvents={open ? "auto" : "none"}
              style={[
                styles.panel,
                {
                  opacity: travel,
                  transform: [
                    {
                      translateY: travel.interpolate({
                        inputRange: [0, 1],
                        outputRange: [16, 0],
                      }),
                    },
                    {
                      scale: travel.interpolate({
                        inputRange: [0, 1],
                        outputRange: [0.96, 1],
                      }),
                    },
                  ],
                },
              ]}
            >
              {children}
            </Animated.View>
          </Animated.View>
        </Animated.View>
      </Overlay>
    </>
  );
}

const styles = StyleSheet.create({
  scrim: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.scrim,
  },
  lift: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    position: "absolute",
    left: spacing.m,
    right: spacing.m,
  },
  panel: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    padding: spacing.m,
    gap: sheetGap,
    ...shadows.floating,
  },
});

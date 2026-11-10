import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { Progress } from "@/lib/motion/progress";
import { bottomBar, colors, measure, spacing } from "@/theme/tokens";
import { NavTab } from "./nav-tab";

/** What the `action` slot reads from the bar. */
export type BarState = {
  /** The bar's height: its row plus its own padding, in points. */
  height: number;
  /**
   * Hands the bar the sheet's clock. The slot calls it once at mount,
   * and the bar slides on that value in an animated style.
   */
  setHide: (progress: Progress) => void;
};

const BarContext = React.createContext<BarState | null>(null);

/** The bar's height and its hide clock, for the component in the
    `action` slot. */
export function useBar(): BarState {
  const bar = React.useContext(BarContext);
  if (bar == null) {
    throw new Error("useBar needs a BottomBar above it");
  }
  return bar;
}

/**
 * The bottom bar both tabs share. Left: the Lists and Planner nav
 * items. Right: the `action` slot, which the screen's route fills
 * (the capture dock). The bar knows no feature. The slot reads the
 * bar's height and hands it the sheet's clock, and the bar slides away
 * on that clock with a transform.
 *
 * The bar's surface spans the window. Its row holds to the reading
 * measure, so the nav and the action sit in the content column.
 */
export function BottomBar({ action }: { action: React.ReactNode }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // The sheet's clock, or null while no slot drives the bar.
  const [hide, setHide] = React.useState<Progress | null>(null);
  // The bar's height, measured with no clip in the way.
  const [height, setHeight] = React.useState(0);
  const state = React.useMemo(() => ({ height, setHide }), [height, setHide]);

  // The box stays, so no frame runs a layout pass. A full height of
  // travel puts the bar out of the window.
  const slide = useAnimatedStyle(
    () => ({
      transform: [{ translateY: hide == null ? 0 : hide.value * height }],
    }),
    [hide, height],
  );

  return (
    <BarContext.Provider value={state}>
      <Animated.View
        testID="bottom-bar"
        style={[styles.bar, { paddingBottom: insets.bottom + spacing.s }, slide]}
        onLayout={(event) => {
          const next = event.nativeEvent.layout.height;
          if (next > 0) {
            setHeight(next);
          }
        }}
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
        <View style={styles.row}>
          <NavTab
            label="Lists"
            icon="list"
            active={pathname === "/"}
            onPress={() => router.navigate("/")}
          />
          <NavTab
            label="Planner"
            icon="calendar"
            active={pathname === "/planner"}
            onPress={() => router.navigate("/planner")}
          />
          {/* The air between the nav and the action. */}
          <View style={styles.spacer} />
          {action}
        </View>
      </Animated.View>
    </BarContext.Provider>
  );
}

const styles = StyleSheet.create({
  navBand: {
    position: "absolute",
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
    maxWidth: measure,
    width: "100%",
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    minHeight: bottomBar.row,
  },
  spacer: {
    flex: 1,
    minWidth: spacing.xl,
  },
});

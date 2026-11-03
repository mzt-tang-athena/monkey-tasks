import * as React from "react";
import { Animated, StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  bottomBar,
  colors,
  measure,
  spacing,
} from "@/theme/tokens";
import { NavTab } from "./nav-tab";

/** What the `action` slot reads from the bar. */
export type BarState = {
  /** The bar's height: its row plus its own padding, in points. */
  height: number;
  /**
   * The bar's lift: 1 shows the bar, 0 slides it away. The slot drives
   * it, so its own motion and the bar's collapse share one clock.
   */
  lift: Animated.Value;
};

const BarContext = React.createContext<BarState | null>(null);

/** The bar's height and lift, for the component in the `action` slot. */
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
 * bar's height and lift through `useBar` and drives the collapse.
 *
 * The bar's surface spans the window. Its row holds to the reading
 * measure, so the nav and the action sit in the content column.
 */
export function BottomBar({ action }: { action: React.ReactNode }) {
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [lift] = React.useState(() => new Animated.Value(1));
  // The row's height, measured where the collapse clip cannot reach it.
  const [rowHeight, setRowHeight] = React.useState(36);
  // The bar's height is computed and not measured: the collapse clip
  // clamps the height it would measure, and the bar would lose its
  // bottom padding.
  const height = rowHeight + spacing.s + insets.bottom + spacing.s;
  const state = React.useMemo(() => ({ height, lift }), [height, lift]);

  return (
    <BarContext.Provider value={state}>
      {/* The bar slides away while the slot asks, and returns after. */}
      <Animated.View
        style={[
          styles.clip,
          {
            maxHeight: lift.interpolate({
              inputRange: [0, 1],
              outputRange: [0, height],
            }),
            opacity: lift,
          },
        ]}
      >
        <View style={[styles.bar, { paddingBottom: insets.bottom + spacing.s }]}>
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
              const next = event.nativeEvent.layout.height;
              if (next > 0) {
                setRowHeight(next);
              }
            }}
          >
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
        </View>
      </Animated.View>
    </BarContext.Provider>
  );
}

const styles = StyleSheet.create({
  clip: {
    overflow: "hidden",
  },
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

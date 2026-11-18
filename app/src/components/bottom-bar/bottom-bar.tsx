import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import { PullSurface } from "@/components/motion/pull";
import { motion } from "@/lib/motion/tokens";
import { useCommandPane } from "@/hooks/use-command-pane";
import type { Progress } from "@/lib/motion/progress";
import { bottomBar, measure, spacing, type Palette } from "@/theme/tokens";
import { useThemedStyles } from "@/theme/theme-provider";
import { NavTab } from "./nav-tab";
import { useBarSpace } from "./bar-space";

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
 * The bottom bar every tab shares. Left: the four nav items. Right: the
 * `action` slot, which the screen's route fills (the split Add pill).
 * The bar knows no feature. The gap between them takes a downward pull
 * and opens the command pane. The slot reads the bar's height and hands
 * it the sheet's clock, and the bar slides away on that clock.
 *
 * The bar's surface spans the window. Its row holds to the reading
 * measure, so the nav and the action sit in the content column.
 */
export function BottomBar({ action }: { action: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
  const { show } = useCommandPane();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  // The sheet's clock, or null while no slot drives the bar.
  const [hide, setHide] = React.useState<Progress | null>(null);
  // The bar's height, measured with no clip in the way. The root
  // provider shares it with the page burst, which sits above the
  // screen and must stop at the bar's top edge.
  const space = useBarSpace();
  const [localHeight, setLocalHeight] = React.useState(0);
  const height = space?.height ?? localHeight;
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
          if (next <= 0) {
            return;
          }
          if (space == null) {
            setLocalHeight(next);
          } else {
            space.report(next);
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
          <View style={styles.nav} role="tablist" aria-label="screens">
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
            <NavTab
              label="Journal"
              icon="journal"
              active={pathname === "/journal"}
              onPress={() => router.navigate("/journal")}
            />
            <NavTab
              label="Inbox Notes"
              icon="inbox"
              active={pathname === "/inbox"}
              onPress={() => router.navigate("/inbox")}
            />
          </View>
          {/* The air between the nav and the action. A downward pull
              here opens the pane; the tabs and the pill keep theirs. */}
          <PullSurface
            direction="down"
            onPull={show}
            commit={motion.pull.bar}
            testID="bar-gap"
            style={styles.spacer}
          />
          {action}
        </View>
      </Animated.View>
    </BarContext.Provider>
  );
}

const makeStyles = (colors: Palette) => ({
  styles: StyleSheet.create({
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
    nav: {
      flexDirection: "row",
      gap: spacing.xs,
    },
    spacer: {
      flex: 1,
      minWidth: spacing.xl,
      // The row centers its children, so an empty view would have no
      // height to swipe. The gap takes the row's full height instead.
      alignSelf: "stretch",
    },
  }),
});

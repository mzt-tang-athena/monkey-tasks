import * as React from "react";
import { StyleSheet, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { useAnimatedStyle } from "react-native-reanimated";
import type { Progress } from "@/lib/motion/progress";
import type { IconName } from "@/components/ui/icon";
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
  /** The tab on screen, counted from the first. */
  tab: number;
  /** How many tabs the bar carries. */
  tabs: number;
  /** Moves one tab, and stays at either end. */
  stepTab: (step: 1 | -1) => void;
};

const BarContext = React.createContext<BarState | null>(null);

/** The bar's height, its tabs and its hide clock, for the component in
    the `action` slot. */
export function useBar(): BarState {
  const bar = React.useContext(BarContext);
  if (bar == null) {
    throw new Error("useBar needs a BottomBar above it");
  }
  return bar;
}

/**
 * The bar's tabs, left to right. The nav draws them and the action
 * slot's swipes and keys step through the same list, so one order holds
 * for every way a user reaches a tab.
 */
const TABS: readonly { path: string; label: string; icon: IconName }[] = [
  { path: "/", label: "Lists", icon: "list" },
  { path: "/planner", label: "Planner", icon: "calendar" },
  { path: "/inbox", label: "Inbox Notes", icon: "inbox" },
  { path: "/journal", label: "Journal", icon: "journal" },
];

/**
 * The bottom bar every tab shares. Left: the four nav items. Right: the
 * `action` slot, which the screen's route fills (the Add button). The
 * bar knows no feature. The slot reads the bar's height, its tab and
 * its tab step, and hands it the sheet's clock, and the bar slides away
 * on that clock.
 *
 * The bar's surface spans the window. Its row holds to the reading
 * measure, so the nav and the action sit in the content column.
 */
export function BottomBar({ action }: { action: React.ReactNode }) {
  const { styles } = useThemedStyles(makeStyles);
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
  const tab = TABS.findIndex((entry) => entry.path === pathname);

  // A swipe or a key moves one tab. The ends hold: a page that moved
  // past the last tab would carry the selection against the finger.
  const stepTab = React.useCallback(
    (step: 1 | -1) => {
      const next = tab + step;
      if (tab < 0 || next < 0 || next >= TABS.length) {
        return;
      }
      router.navigate(TABS[next].path);
    },
    [tab],
  );

  const state = React.useMemo(
    () => ({ height, setHide, tab, tabs: TABS.length, stepTab }),
    [height, tab, stepTab],
  );

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
            {TABS.map((entry) => (
              <NavTab
                key={entry.path}
                label={entry.label}
                icon={entry.icon}
                active={pathname === entry.path}
                onPress={() => router.navigate(entry.path)}
              />
            ))}
          </View>
          {/* The air between the nav and the action. It carries no
              gesture: the Add button holds the bar's swipes. */}
          <View style={styles.spacer} />
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
    },
  }),
});

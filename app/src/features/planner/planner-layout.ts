import { StyleSheet } from "react-native";
import { colors, measure, pageGutter, spacing } from "@/theme/tokens";

/**
 * The planner's shared frame and pane styles, and nothing else. Every
 * other style sits next to the component that reads it.
 */
export const layout = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    // Drags must not start native text selection in the web preview.
    userSelect: "none",
  },
  // Week and month: the fixed frame. Header and calendar sit still;
  // only the bottom pane scrolls. No side padding: the period rail and
  // the week canvas run to the screen's edges, and every other block
  // takes the gutter itself.
  frame: {
    flex: 1,
    width: "100%",
    maxWidth: measure,
    alignSelf: "center",
    gap: spacing.m,
  },
  // The page gutter, for a block in the week and month frame.
  gutter: {
    paddingHorizontal: pageGutter,
  },
  // Week's calendar and its list pane share one block under the
  // header: the pane starts where the canvas ends.
  weekBody: {
    flex: 1,
  },
  // The day root: the header, then the pager that holds the body.
  dayRoot: {
    flex: 1,
    width: "100%",
    maxWidth: measure,
    alignSelf: "center",
    paddingHorizontal: pageGutter,
    gap: spacing.m,
  },
  // The day page: the swipe slides it sideways inside the root.
  dayPage: {
    flex: 1,
    gap: spacing.m,
  },
  // The split's panes each fill their half; the surface sets their
  // share by fraction.
  pane: {
    flex: 1,
    gap: spacing.s,
  },
  paneList: {
    flex: 1,
  },
  paneScroll: {
    flex: 1,
  },
});

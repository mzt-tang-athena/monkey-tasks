import { StyleSheet } from "react-native";
import { colors, fonts, spacing, radius, radiusFloating, radii, measure, weekColWidth, weekCanvasHeight, pageGutter } from "../../../theme/tokens";

export const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    // Drags must not start native text selection in the web preview.
    userSelect: "none" as const,
  },
  // week and month: the fixed frame. Header and calendar sit still;
  // only the bottom pane scrolls.
  frame: {
    flex: 1,
    width: "100%" as const,
    maxWidth: measure,
    alignSelf: "center" as const,
    paddingHorizontal: pageGutter,
    // No top padding: the selected strip tab hangs from the screen's
    // top edge, and the content below gains the space.
  },
  pressedFill: {
    backgroundColor: colors.pressed,
  },

  // period strip: day cells, then the wider week and month cells
  strip: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginBottom: spacing.s,
  },
  stripScroll: {
    flexDirection: "row",
    gap: spacing.s,
    alignItems: "flex-end",
    // The same bottom spacing the day strip has, so the wide strips
    // never touch the pills. Page grid inside, screen-edge bleed
    // outside: the rail cuts at the display, not the gutter.
    marginBottom: spacing.s,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
  },
  stripDay: {
    alignItems: "center",
    justifyContent: "center",
    width: 44,
    height: 44,
    borderRadius: radius,
  },
  stripDayActive: {
    // The selected tab hangs from the screen's top edge: square top,
    // rounded bottom, standing taller than its resting neighbours.
    height: 52,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    backgroundColor: colors.accent,
  },
  stripDayToday: {
    backgroundColor: colors.accentSoft,
  },
  stripName: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    letterSpacing: 0.5,
  },
  stripNameActive: {
    color: colors.onAccent,
  },
  stripNameToday: {
    color: colors.accent,
    fontWeight: "600",
  },
  stripNum: {
    fontSize: 16,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.ink,
    marginTop: 2,
  },
  stripNumActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },
  stripNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },

  // shared bottom-half section: source left, form toggle right
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: spacing.s,
  },
  sectionSpacer: {
    flex: 1,
  },
  formToggle: {
    flexDirection: "row",
    gap: 2,
    padding: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    backgroundColor: colors.surface,
  },
  formSegment: {
    width: 32,
    height: 26,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius - 2,
  },
  formSegmentActive: {
    backgroundColor: colors.accent,
  },
  formSegmentPressed: {
    backgroundColor: colors.pressed,
  },
  // Square corners on a selected segment's open sides; the closed
  // sides keep the shared radius.
  segmentFirst: {
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentMiddle: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    borderTopRightRadius: 0,
    borderBottomRightRadius: 0,
  },
  segmentLast: {
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
  },
  formGlyphRows: {
    alignItems: "flex-start",
    gap: 3,
  },
  formGlyphBar: {
    width: 14,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.inkMuted,
  },
  formGlyphBarShort: {
    width: 9,
  },
  formGlyphBarActive: {
    backgroundColor: colors.onAccent,
  },
  formGlyphPill: {
    width: 16,
    height: 9,
    borderRadius: 4.5,
    borderWidth: 1.5,
    borderColor: colors.inkMuted,
  },
  formGlyphPillActive: {
    borderColor: colors.onAccent,
  },
  monthDotSlot: {
    height: 4,
    alignItems: "center",
    justifyContent: "center",
  },

  // segmented toggle, E's tighter spacing
  segmented: {
    flexDirection: "row",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: 3,
    marginBottom: spacing.m,
  },
  segment: {
    flex: 1,
    minHeight: 32,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radius,
  },
  segmentActive: {
    backgroundColor: colors.accent,
  },
  segmentText: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  segmentTextActive: {
    color: colors.onAccent,
    fontWeight: "600",
  },

  // compact day heading
  dateMonth: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
  },
  dateHeader: {
    fontSize: 26,
    lineHeight: 32,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  dateRule: {
    height: 2,
    backgroundColor: colors.accent,
    width: 40,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
    borderRadius: 1,
  },
  overdueBlock: {
    marginBottom: spacing.l,
  },
  overdueLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.danger,
    marginBottom: spacing.xs,
  },
  sectionLabel: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    fontWeight: "700",
    letterSpacing: 1.2,
    textTransform: "uppercase",
    color: colors.accent,
    marginBottom: spacing.s,
  },
  groupRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },

  // hour ruler
  ruler: {},
  rulerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    minHeight: 44,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.hairline,
  },
  rulerRowHover: {
    backgroundColor: colors.accentSoft,
  },
  rulerMark: {
    width: 56,
    fontSize: 11,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
    paddingTop: spacing.xs,
  },
  rulerSlot: {
    flex: 1,
    paddingVertical: spacing.xs,
    gap: spacing.xs,
  },
  hourTask: {
    flexDirection: "row",
    // Optical centering: the circle, the accent bar, and the text
    // share one center line within the chip.
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.s,
    gap: spacing.s,
  },
  taskBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.accent,
    minHeight: 20,
  },
  taskBody: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
  },
  taskName: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  taskTime: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontVariant: ["tabular-nums"],
  },
  nowLineRow: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 18,
  },
  nowDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.danger,
    marginRight: spacing.xs,
  },
  nowLine: {
    flex: 1,
    height: 1.5,
    backgroundColor: colors.danger,
    borderRadius: 1,
  },

  // day split: fixed header over two panes, sized by the grabber
  dayRoot: {
    flex: 1,
    width: "100%" as const,
    maxWidth: measure,
    alignSelf: "center" as const,
    paddingHorizontal: pageGutter,
    // No top padding: the selected strip tab hangs from the screen's
    // top edge, and the content below gains the space.
  },
  pane: {},
  paneList: {
    flex: 1,
  },
  paneScroll: {
    flex: 1,
  },
  divider: {
    height: 28,
    justifyContent: "center",
    marginTop: spacing.xs,
    marginBottom: spacing.xs,
  },
  dividerLine: {
    position: "absolute" as const,
    left: 0,
    right: 0,
    top: 13,
    borderTopWidth: 1.5,
    borderStyle: "dashed",
    borderColor: colors.hairline,
  },
  dividerActive: {
    borderTopColor: colors.accent,
  },
  grabberHit: {
    alignSelf: "center" as const,
    width: 72,
    height: 28,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    borderRadius: radius,
  },
  grabberHitHot: {
    backgroundColor: colors.pressed,
  },
  grabberBar: {
    width: 44,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.inkFaint,
  },
  grabberBarActive: {
    backgroundColor: colors.accent,
  },
  dragGhost: {
    position: "absolute" as const,
    width: 200,
    zIndex: 20,
  },
  dragGhostChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.s,
    backgroundColor: colors.accent,
    borderRadius: radiusFloating,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    shadowColor: colors.ink,
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  ghostBar: {
    width: 3,
    borderRadius: 1.5,
    backgroundColor: colors.onAccent,
    minHeight: 20,
  },
  dragGhostText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.onAccent,
    fontWeight: "600",
  },

  // The source toggle: the label slot reserves the widest source's
  // width, so the control never resizes mid-press - the pressed
  // preview must not move the box out from under the pointer.
  sourceToggle: {
    flexDirection: "row",
    alignItems: "center" as const,
    alignSelf: "flex-start" as const,
    gap: spacing.xs,
    minHeight: 32,
    paddingLeft: spacing.s,
    paddingRight: spacing.s,
    borderRadius: radius,
  },
  sourceToggleHot: {
    backgroundColor: colors.pressed,
  },
  sourceToggleText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
    minWidth: 96,
  },
  sourceToggleTextHot: {
    color: colors.accent,
  },
  sourceToggleChevron: {
    fontSize: 10,
    lineHeight: 14,
    color: colors.inkFaint,
  },
  menuBackdrop: {
    position: "absolute" as const,
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
  },
  sourceMenu: {
    position: "absolute" as const,
    width: 200,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radiusFloating,
    paddingVertical: spacing.xs,
    shadowColor: colors.ink,
    shadowOpacity: 0.14,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center" as const,
    minHeight: 40,
    paddingHorizontal: spacing.m,
  },
  menuItemPressed: {
    backgroundColor: colors.pressed,
  },
  menuItemText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  menuItemCheck: {
    fontSize: 13,
    lineHeight: 18,
    color: colors.accent,
    fontWeight: "700",
  },

  // week foot pills row
  pillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s,
  },
  pillChip: {
    flexDirection: "row",
    alignItems: "center" as const,
    gap: spacing.xs,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radii.pill,
    paddingLeft: spacing.m,
    paddingRight: spacing.m,
    paddingVertical: spacing.s,
    maxWidth: "100%" as const,
  },
  // The pickup feedback: a quiet tint while the hold is running,
  // then a visible lift (scale and shadow) once the drag owns the
  // pointer. The ghost carries the motion after that.
  liftHold: {
    backgroundColor: colors.accentSoft,
  },
  liftPicked: {
    backgroundColor: colors.accentSoft,
    transform: [{ scale: 1.03 }],
    shadowColor: colors.ink,
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  pillGrip: {
    alignItems: "center" as const,
    gap: 2,
  },
  pillGripDot: {
    width: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.inkFaint,
  },
  pillText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  pillDate: {
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },

  // week and month drop targets during a pill drag
  weekColHovered: {
    borderColor: colors.accent,
    borderWidth: 1.5,
  },
  monthCellHovered: {
    backgroundColor: colors.accentSoft,
  },
  monthPickedBlock: {
    marginBottom: spacing.s,
  },

  // timeline task chip: its own circle is the done toggle
  taskBarDone: {
    backgroundColor: colors.inkFaint,
  },
  tickCircle: {
    width: 18,
    height: 18,
    borderRadius: radii.pill,
    borderWidth: 1.5,
    borderColor: colors.inkFaint,
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  tickCircleDone: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  tickCheck: {
    color: colors.onAccent,
    fontSize: 11,
    lineHeight: 13,
    fontWeight: "600",
  },
  taskNameDone: {
    color: colors.inkFaint,
    textDecorationLine: "line-through",
  },
  taskTimeDone: {
    color: colors.inkFaint,
  },

  // The period rail bleeds past the page gutter: cells cut at the
  // display's edges, scrolling until the last one clears the grid.
  railBleed: {
    marginHorizontal: -pageGutter,
  },
  // week canvas: horizontally scrolling day columns. The scroller
  // bleeds to the screen's edges: columns cut at the display, not
  // the page gutter, and scroll till the last one clears it.
  // week canvas: horizontally scrolling day columns. The scroller
  // bleeds to the screen's edges: columns cut at the display, not
  // the page gutter, and scroll till the last one clears it. The
  // bounded height keeps tall viewports from stretching the columns
  // into the bottom section's space.
  weekScroller: {
    flexGrow: 0,
    flexShrink: 0,
    height: weekCanvasHeight,
    marginHorizontal: -pageGutter,
  },
  weekCanvas: {
    flexDirection: "row",
    gap: spacing.s,
    paddingVertical: spacing.xs,
    paddingLeft: pageGutter,
    paddingRight: pageGutter,
    marginBottom: spacing.xl,
  },
  weekCol: {
    width: weekColWidth,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    borderRadius: radius,
    padding: spacing.s,
    minHeight: 240,
  },
  weekColSelected: {
    borderColor: colors.accent,
  },
  weekColToday: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accent,
  },
  weekDayName: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  weekDayNum: {
    fontSize: 18,
    lineHeight: 24,
    fontFamily: fonts.display,
    color: colors.ink,
  },
  weekDayNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  weekColRule: {
    height: 1,
    backgroundColor: colors.hairline,
    marginVertical: spacing.s,
  },
  weekTask: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.paper,
    borderRadius: radius,
    padding: spacing.xs,
    marginBottom: spacing.xs,
  },
  weekTaskText: {
    flex: 1,
    fontSize: 11,
    lineHeight: 15,
    fontFamily: fonts.body,
    color: colors.ink,
  },
  weekFree: {
    fontSize: 12,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkFaint,
    textAlign: "center",
  },

  // month view
  monthColumn: {
    flex: 1,
  },
  // The fixed half: title and grid card. Its own swipe zone shifts
  // months without touching the row drags beneath.
  monthFixed: {
    flexShrink: 0,
  },
  monthTitle: {
    fontSize: 13,
    lineHeight: 16,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: spacing.s,
  },
  monthCard: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.hairline,
    padding: spacing.m,
    marginBottom: spacing.m,
  },
  monthHead: {
    flexDirection: "row",
  },
  monthHeadCell: {
    flex: 1,
    textAlign: "center",
    fontSize: 11,
    lineHeight: 14,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    fontWeight: "600",
  },
  monthGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  monthCell: {
    width: "14.28%" as const,
    aspectRatio: 1.1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    borderRadius: radius,
  },
  monthCellPicked: {
    backgroundColor: colors.accentSoft,
  },
  monthCellToday: {
    backgroundColor: colors.accentSoft,
  },
  monthNum: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    color: colors.inkMuted,
  },
  monthNumToday: {
    color: colors.accent,
    fontWeight: "700",
  },
  monthDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  monthDayOpen: {
    alignSelf: "flex-start" as const,
    marginTop: spacing.s,
    minHeight: 32,
    justifyContent: "center",
    paddingHorizontal: spacing.m,
    borderRadius: radius,
  },
  monthDayOpenText: {
    fontSize: 13,
    lineHeight: 17,
    fontFamily: fonts.body,
    color: colors.accent,
    fontWeight: "600",
  },
  detailsPressed: {
    backgroundColor: colors.pressed,
  },

  // states
  holder: {
    minHeight: 160,
    justifyContent: "center",
    paddingVertical: spacing.xl,
  },
  skeleton: {
    height: 14,
    borderRadius: radii.pill,
    backgroundColor: colors.hairline,
    marginVertical: spacing.m,
  },
  empty: {
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.inkMuted,
    textAlign: "center",
  },
  retry: {
    alignSelf: "center",
    minHeight: 36,
    justifyContent: "center",
    marginTop: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: radius,
    backgroundColor: colors.accent,
  },
  retryPressed: {
    backgroundColor: colors.accentDeep,
  },
  retryText: {
    fontSize: 14,
    lineHeight: 18,
    fontFamily: fonts.body,
    fontWeight: "600",
    color: colors.onAccent,
  },
});
